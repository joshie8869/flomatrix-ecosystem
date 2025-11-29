// app/engine/core/sample-ohlc.js
// FloEngine v3.0 — synthetic OHLC sample data
// Generates a simple intraday-ish series for local testing.
//
// FM-SAMPLE-OHLC-001

/**
 * Generate a synthetic OHLCV series for testing the renderer
 * and chart core without connecting to real data feeds.
 *
 * Each bar is:
 *   {
 *     t: number (timestamp in ms),
 *     o: number,
 *     h: number,
 *     l: number,
 *     c: number,
 *     v: number
 *   }
 *
 * @param {Object} opts
 * @param {number} opts.length   Number of bars
 * @param {number} opts.startPrice Starting price
 * @param {number} opts.volatility  Approx range of random moves
 * @param {number} opts.intervalMs  Time step between bars
 * @returns {Array}
 */
function generateSampleSeries({
  length = 500,
  startPrice = 42000,
  volatility = 120,
  intervalMs = 60_000, // 1-minute bars by default
} = {}) {
  const out = [];
  let lastClose = startPrice;
  const now = Date.now();
  const startTime = now - length * intervalMs;

  for (let i = 0; i < length; i++) {
    const t = startTime + i * intervalMs;

    // random walk
    const noise =
      (Math.random() - 0.5) * volatility +
      (Math.random() - 0.5) * (volatility * 0.3);

    const o = lastClose;
    const c = Math.max(50, o + noise); // guard against negative / tiny
    const mid = (o + c) / 2;

    const spreadHigh = Math.random() * (volatility * 0.5);
    const spreadLow = Math.random() * (volatility * 0.5);

    const h = mid + spreadHigh;
    const l = mid - spreadLow;

    const vBase = 1_000;
    const vNoise = Math.random() * 2_000;
    const v = vBase + vNoise;

    out.push({
      t,
      o,
      h,
      l,
      c,
      v,
    });

    lastClose = c;
  }

  return out;
}

/**
 * Default exported sample series for FloEngine.
 * ~500 bars of synthetic BTCUSD-like action.
 */
export const SAMPLE_OHLC = generateSampleSeries({
  length: 500,
  startPrice: 42000,
  volatility: 180,
  intervalMs: 60_000,
});
