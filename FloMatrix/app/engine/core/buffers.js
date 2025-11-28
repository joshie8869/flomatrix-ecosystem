// app/engine/core/buffers.js
// FloEngine v1.3 — convert OHLC data into full candle geometry.

import { SAMPLE_OHLC } from "./sample-ohlc.js";

// get vertical price scale based on OHLC range
function computePriceRange(data) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const bar of data) {
    if (bar.l < min) min = bar.l;
    if (bar.h > max) max = bar.h;
  }

  // add a little buffer top/bottom
  const padding = (max - min) * 0.05;
  return {
    min: min - padding,
    max: max + padding
  };
}

// map price -> y coordinate (pixels, top=0)
function priceToY(price, minPrice, maxPrice, top, chartHeight) {
  const t = (price - minPrice) / (maxPrice - minPrice); // 0..1 from bottom to top
  const y = top + chartHeight - t * chartHeight;        // inverted (higher price = higher y)
  return y;
}

export function initBuffers(gl, program, getRes) {
  const { width, height } = getRes();

  // chart paddings (we'll integrate real axes later)
  const paddingLeft = 70;
  const paddingRight = 70;
  const paddingTop = 40;
  const paddingBottom = 40;

  const chartWidth = Math.max(1, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(1, height - paddingTop - paddingBottom);

  const barCount = SAMPLE_OHLC.length;
  const barSpacing = chartWidth / barCount;
  const candleBodyWidth = barSpacing * 0.55;
  const wickWidth = Math.max(1.5, candleBodyWidth * 0.18);

  const { min: priceMin, max: priceMax } = computePriceRange(SAMPLE_OHLC);

  const vertices = [];

  function pushRect(xCenter, yTop, yBottom, widthPx, bullFlag) {
    const halfW = widthPx / 2;
    const x1 = xCenter - halfW;
    const x2 = xCenter + halfW;
    const y1 = yBottom;
    const y2 = yTop;

    // two triangles
    vertices.push(
      x1, y1, bullFlag,
      x2, y1, bullFlag,
      x1, y2, bullFlag,

      x1, y2, bullFlag,
      x2, y1, bullFlag,
      x2, y2, bullFlag
    );
  }

  // build geometry from OHLC
  SAMPLE_OHLC.forEach((bar, index) => {
    const xCenter = paddingLeft + barSpacing * (index + 0.5);

    const bull = bar.c >= bar.o ? 1.0 : 0.0;
    const bodyHighPrice = Math.max(bar.o, bar.c);
    const bodyLowPrice = Math.min(bar.o, bar.c);

    const yHigh = priceToY(bar.h, priceMin, priceMax, paddingTop, chartHeight);
    const yLow = priceToY(bar.l, priceMin, priceMax, paddingTop, chartHeight);
    const yBodyHigh = priceToY(bodyHighPrice, priceMin, priceMax, paddingTop, chartHeight);
    const yBodyLow = priceToY(bodyLowPrice, priceMin, priceMax, paddingTop, chartHeight);

    // wick (high -> low), drawn as a thin rect
    pushRect(xCenter, yHigh, yLow, wickWidth, bull);

    // body (open/close)
    pushRect(xCenter, yBodyHigh, yBodyLow, candleBodyWidth, bull);
  });

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "a_position");
  const aBull = gl.getAttribLocation(program, "a_bull");

  const stride = 3 * 4;     // 3 floats per vertex
  const offsetPos = 0;
  const offsetBull = 2 * 4; // bull flag

  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, offsetPos);

  gl.enableVertexAttribArray(aBull);
  gl.vertexAttribPointer(aBull, 1, gl.FLOAT, false, stride, offsetBull);

  return {
    buffer,
    vertexCount: vertices.length / 3,
    getRes,
    priceMin,
    priceMax,
    chartWidth,
    chartHeight,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom
  };
}
