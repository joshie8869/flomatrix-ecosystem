// app/engine/core/buffers.js
// FloEngine v1.5 → v3.0 — institutional candle geometry + grid lines + footprint layout
//
// This file:
//  - Builds candle and grid geometry (existing behavior, preserved).
//  - Computes chart layout and price range.
//  - Prepares shared layout fields for the footprint module.
//  - Leaves actual footprint buffer creation to the footprint module.
//
// Footprint specifics (FloEngine v3):
//  - We add fields: footprintBuffer, footprintVertexCount, footprintMode
//  - The buffer itself is allocated & filled by rebuildFootprintBuffer(...) in footprint.js.

import { SAMPLE_OHLC } from "./sample-ohlc.js";
import { FOOTPRINT_MODE_BID_ASK } from "../modules/footprint.js";

/* FM-PAD:BEGIN-BUFFERS-CORE-UTILS */
function computePriceRange(data) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const bar of data) {
    if (bar.l < min) min = bar.l;
    if (bar.h > max) max = bar.h;
  }

  const padding = (max - min) * 0.05;
  return {
    min: min - padding,
    max: max + padding
  };
}

function priceToY(price, minPrice, maxPrice, top, chartHeight) {
  const t = (price - minPrice) / (maxPrice - minPrice);
  const y = top + chartHeight - t * chartHeight;
  return y;
}
/* FM-PAD:END-BUFFERS-CORE-UTILS */

/* FM-PAD:BEGIN-BUFFERS-CORE-INIT */
export function initBuffers(gl, program, getRes) {
  const { width, height } = getRes();

  const paddingLeft = 80;
  const paddingRight = 90;   // room for price rail
  const paddingTop = 50;
  const paddingBottom = 60;

  const chartWidth = Math.max(1, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(1, height - paddingTop - paddingBottom);

  const barCount = SAMPLE_OHLC.length;
  const barSpacing = chartWidth / Math.max(1, barCount);

  // Refined proportions
  const bodyWidthOuter = barSpacing * 0.48;              // outer body (border shell)
  const bodyWidthInner = bodyWidthOuter * 0.78;          // inner fill body
  const wickWidth = Math.max(0.8, bodyWidthOuter * 0.09); // thinner, refined wick

  const { min: priceMin, max: priceMax } = computePriceRange(SAMPLE_OHLC);

  const candleVertices = [];
  const gridVertices = [];

  function pushRect(targetArray, xCenter, yTop, yBottom, widthPx, bullFlag, borderFlag) {
    const halfW = widthPx / 2;
    const x1 = xCenter - halfW;
    const x2 = xCenter + halfW;
    const y1 = yBottom;
    const y2 = yTop;

    targetArray.push(
      x1, y1, bullFlag, borderFlag,
      x2, y1, bullFlag, borderFlag,
      x1, y2, bullFlag, borderFlag,

      x1, y2, bullFlag, borderFlag,
      x2, y1, bullFlag, borderFlag,
      x2, y2, bullFlag, borderFlag
    );
  }

  function pushLine(x1, y1, x2, y2) {
    // bullFlag=0, borderFlag=3 for grid
    gridVertices.push(
      x1, y1, 0.0, 3.0,
      x2, y2, 0.0, 3.0
    );
  }

  // --- Build candles ---
  SAMPLE_OHLC.forEach((bar, index) => {
    const xCenter = paddingLeft + barSpacing * (index + 0.5);

    const bull = bar.c >= bar.o ? 1.0 : 0.0;
    const bodyHighPrice = Math.max(bar.o, bar.c);
    const bodyLowPrice = Math.min(bar.o, bar.c);

    const yHigh = priceToY(bar.h, priceMin, priceMax, paddingTop, chartHeight);
    const yLow = priceToY(bar.l, priceMin, priceMax, paddingTop, chartHeight);
    const yBodyHigh = priceToY(bodyHighPrice, priceMin, priceMax, paddingTop, chartHeight);
    const yBodyLow = priceToY(bodyLowPrice, priceMin, priceMax, paddingTop, chartHeight);

    // WICK — thin, refined, borderFlag=2.0
    pushRect(candleVertices, xCenter, yHigh, yLow, wickWidth, bull, 2.0);

    // OUTER BODY (border shell) — borderFlag=1.0
    pushRect(candleVertices, xCenter, yBodyHigh, yBodyLow, bodyWidthOuter, bull, 1.0);

    // INNER BODY (fill) — borderFlag=0.0
    const innerTop = yBodyHigh + 1.5;
    const innerBottom = yBodyLow - 1.5;
    pushRect(candleVertices, xCenter, innerTop, innerBottom, bodyWidthInner, bull, 0.0);
  });

  // --- Build faint grid (X/Y axes style) ---

  // Horizontal lines (price axis) — 5 segments
  const horizontalCount = 5;
  for (let i = 0; i <= horizontalCount; i++) {
    const frac = i / horizontalCount;
    const y = paddingTop + chartHeight * frac;
    pushLine(paddingLeft, y, paddingLeft + chartWidth, y);
  }

  // Vertical lines (time axis) — 8 segments
  const verticalCount = 8;
  for (let i = 0; i <= verticalCount; i++) {
    const frac = i / verticalCount;
    const x = paddingLeft + chartWidth * frac;
    pushLine(x, paddingTop, x, paddingTop + chartHeight);
  }

  // --- Create buffers ---

  const candleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, candleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(candleVertices), gl.STATIC_DRAW);

  const gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVertices), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "a_position");
  const aBull = gl.getAttribLocation(program, "a_bull");
  const aBorder = gl.getAttribLocation(program, "a_border");

  return {
    candleBuffer,
    gridBuffer,
    candleVertexCount: candleVertices.length / 4, // 4 floats per vertex
    gridVertexCount: gridVertices.length / 4,
    aPosition,
    aBull,
    aBorder,
    getRes,
    priceMin,
    priceMax,
    chartWidth,
    chartHeight,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,

    // Footprint layer (to be populated by footprint module)
    footprintBuffer: null,
    footprintVertexCount: 0,
    footprintMode: FOOTPRINT_MODE_BID_ASK
  };
}
/* FM-PAD:END-BUFFERS-CORE-INIT */
