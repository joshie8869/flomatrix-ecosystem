// app/engine/modules/footprint.js
// FloEngine v3.0 — Institutional Footprint Geometry (Bid/Ask, Delta, Volume Profile)
// FloMatrix Neon Signature — Option D (ALL THREE modes selectable)
// Phase 3.1 — ENGINE-ONLY (no UI wiring yet)
//
// This module:
//  - Defines footprint modes
//  - Synthesizes basic bid/ask/delta/volume data from SAMPLE_OHLC (placeholder until real feeds)
//  - Builds footprint cell geometry in the SAME vertex format as candles/grid:
//        [ x, y, v_bullEncoded, v_borderCode ]
//  - v_borderCode determines how the fragment shader colors it.
//  - v_bullEncoded is used as a value/intensity (not bull/bear) for footprint cells.
//
//  Footprint modes:
//    0 = BID/ASK columns
//    1 = DELTA blocks
//    2 = VOLUME PROFILE style blocks
//
//  This is designed so we can later plug in real orderflow data without changing the renderer.

import { SAMPLE_OHLC } from "../core/sample-ohlc.js";

/* FM-PAD:BEGIN-FOOTPRINT-MODULE-CONSTANTS */
export const FOOTPRINT_MODE_BID_ASK = 0;
export const FOOTPRINT_MODE_DELTA = 1;
export const FOOTPRINT_MODE_PROFILE = 2;
/* FM-PAD:END-FOOTPRINT-MODULE-CONSTANTS */

/**
 * Utility: map price → Y in pixel coordinates based on layout.
 */
function priceToY(price, layout) {
  const { priceMin, priceMax, paddingTop, chartHeight } = layout;
  const t = (price - priceMin) / (priceMax - priceMin);
  const y = paddingTop + chartHeight - t * chartHeight;
  return y;
}

/**
 * Utility: clamp 0..1
 */
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/**
 * Utility: we encode quads as two triangles (6 vertices) with:
 *   [ x, y, valueEncoded, borderCode ]
 */
function pushRect(targetArray, xCenter, yTop, yBottom, widthPx, valueEncoded, borderCode) {
  const halfW = widthPx / 2;
  const x1 = xCenter - halfW;
  const x2 = xCenter + halfW;
  const y1 = yBottom;
  const y2 = yTop;

  targetArray.push(
    x1, y1, valueEncoded, borderCode,
    x2, y1, valueEncoded, borderCode,
    x1, y2, valueEncoded, borderCode,

    x1, y2, valueEncoded, borderCode,
    x2, y1, valueEncoded, borderCode,
    x2, y2, valueEncoded, borderCode
  );
}

/**
 * Synthetic stats from SAMPLE_OHLC for placeholder footprint data.
 * For now, we derive "volume" from range and body size to create
 * a believable institutional visual without real tape yet.
 */
function buildSyntheticStats(layout) {
  const { priceMin, priceMax, chartWidth, paddingLeft, paddingRight } = layout;
  const barCount = SAMPLE_OHLC.length || 1;
  const barSpacing = chartWidth / barCount;

  const stats = [];

  for (let index = 0; index < SAMPLE_OHLC.length; index++) {
    const bar = SAMPLE_OHLC[index];
    const xCenter = paddingLeft + barSpacing * (index + 0.5);

    const bodyHighPrice = Math.max(bar.o, bar.c);
    const bodyLowPrice = Math.min(bar.o, bar.c);

    const yHigh = priceToY(bar.h, layout);
    const yLow = priceToY(bar.l, layout);
    const yBodyHigh = priceToY(bodyHighPrice, layout);
    const yBodyLow = priceToY(bodyLowPrice, layout);

    const range = Math.max(1, Math.abs(bar.h - bar.l));
    const body = Math.max(1, Math.abs(bar.c - bar.o));

    // synthetic "volume"
    const totalVol = range * 0.7 + body * 1.3;

    // synthetic bid/ask split & delta
    const bidVol = totalVol * (0.4 + 0.2 * Math.random());
    const askVol = totalVol - bidVol;
    const delta = askVol - bidVol;

    stats.push({
      bar,
      index,
      xCenter,
      yHigh,
      yLow,
      yBodyHigh,
      yBodyLow,
      totalVol,
      bidVol,
      askVol,
      delta
    });
  }

  // normalize for visualization
  let maxVol = 0;
  let maxAbsDelta = 0;
  for (const s of stats) {
    if (s.totalVol > maxVol) maxVol = s.totalVol;
    const ad = Math.abs(s.delta);
    if (ad > maxAbsDelta) maxAbsDelta = ad;
  }
  if (maxVol <= 0) maxVol = 1;
  if (maxAbsDelta <= 0) maxAbsDelta = 1;

  for (const s of stats) {
    s.totalVolNorm = s.totalVol / maxVol;
    s.bidNorm = s.bidVol / maxVol;
    s.askNorm = s.askVol / maxVol;
    s.deltaNorm = s.delta / maxAbsDelta; // can be negative
  }

  return stats;
}

/**
 * Build BID/ASK footprint quads.
 * Two vertical columns per candle:
 *  - Left = bid
 *  - Right = ask
 *
 * borderCode:
 *   10.0 → BID column
 *   11.0 → ASK column
 */
function buildBidAskVertices(stats, layout, out) {
  const { chartWidth, paddingLeft, paddingRight } = layout;
  const barCount = stats.length || 1;
  const barSpacing = chartWidth / barCount;

  // Slightly narrower than candle body.
  const columnWidth = barSpacing * 0.38;

  for (const s of stats) {
    const { xCenter, yBodyHigh, yBodyLow, bidNorm, askNorm } = s;

    const halfGap = columnWidth * 0.15;
    const singleWidth = (columnWidth - halfGap) * 0.5;

    const bidX = xCenter - singleWidth - halfGap * 0.5;
    const askX = xCenter + singleWidth + halfGap * 0.5;

    // Use full body height for each column.
    const yTop = yBodyHigh;
    const yBottom = yBodyLow;

    // BID column (borderCode 10.0)
    pushRect(out, bidX, yTop, yBottom, singleWidth, clamp01(bidNorm), 10.0);

    // ASK column (borderCode 11.0)
    pushRect(out, askX, yTop, yBottom, singleWidth, clamp01(askNorm), 11.0);
  }
}

/**
 * Build DELTA footprint blocks.
 * One block per candle, colored by delta (green for positive, magenta for negative).
 *
 * borderCode:
 *   12.0 → DELTA block
 * v_bullEncoded:
 *   in [-1, +1] normalized delta, used for sign + intensity.
 */
function buildDeltaVertices(stats, layout, out) {
  const { chartWidth, paddingLeft } = layout;
  const barCount = stats.length || 1;
  const barSpacing = chartWidth / barCount;

  const blockWidth = barSpacing * 0.55;

  for (const s of stats) {
    const { xCenter, yBodyHigh, yBodyLow, deltaNorm } = s;

    const yTop = yBodyHigh;
    const yBottom = yBodyLow;

    // We pass deltaNorm directly (can be negative).
    pushRect(out, xCenter, yTop, yBottom, blockWidth, deltaNorm, 12.0);
  }
}

/**
 * Build simple VOLUME PROFILE style blocks per candle.
 * One block per candle, intensity = total volume.
 *
 * borderCode:
 *   13.0 → PROFILE block
 * v_bullEncoded:
 *   in [0,1] normalized total volume.
 */
function buildProfileVertices(stats, layout, out) {
  const { chartWidth, paddingLeft } = layout;
  const barCount = stats.length || 1;
  const barSpacing = chartWidth / barCount;

  const blockWidth = barSpacing * 0.65;

  for (const s of stats) {
    const { xCenter, yBodyHigh, yBodyLow, totalVolNorm } = s;

    const yTop = yBodyHigh;
    const yBottom = yBodyLow;

    pushRect(out, xCenter, yTop, yBottom, blockWidth, clamp01(totalVolNorm), 13.0);
  }
}

/* FM-PAD:BEGIN-FOOTPRINT-MODULE-BUILDERS */
/**
 * Build footprint vertices for given mode using SAMPLE_OHLC and layout.
 *
 * layout must supply:
 *  - priceMin, priceMax
 *  - chartWidth, chartHeight
 *  - paddingLeft, paddingRight, paddingTop, paddingBottom
 */
export function buildFootprintVertices(mode, layout) {
  const out = [];
  if (!SAMPLE_OHLC || !SAMPLE_OHLC.length) {
    return out;
  }

  const stats = buildSyntheticStats(layout);

  if (mode === FOOTPRINT_MODE_BID_ASK) {
    buildBidAskVertices(stats, layout, out);
  } else if (mode === FOOTPRINT_MODE_DELTA) {
    buildDeltaVertices(stats, layout, out);
  } else if (mode === FOOTPRINT_MODE_PROFILE) {
    buildProfileVertices(stats, layout, out);
  } else {
    // default fallback → BID/ASK
    buildBidAskVertices(stats, layout, out);
  }

  return out;
}

/**
 * Rebuild and upload the footprint buffer for a given mode.
 * This is called from engine-core when we change footprint mode
 * or when we want to refresh after resize.
 */
export function rebuildFootprintBuffer(gl, buffers, mode) {
  const {
    priceMin,
    priceMax,
    chartWidth,
    chartHeight,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    getRes
  } = buffers;

  const { width, height } = getRes ? getRes() : { width: chartWidth, height: chartHeight };

  const layout = {
    priceMin,
    priceMax,
    chartWidth,
    chartHeight,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    width,
    height
  };

  const vertices = buildFootprintVertices(mode, layout);

  if (!buffers.footprintBuffer) {
    buffers.footprintBuffer = gl.createBuffer();
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.footprintBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  buffers.footprintVertexCount = vertices.length / 4; // 4 floats per vertex
  buffers.footprintMode = mode;
}
/* FM-PAD:END-FOOTPRINT-MODULE-BUILDERS */
