// app/engine/scales/scale-engine.js
// FloEngine v3.0 — Institutional Price/Time Scale Engine
// Handles all coordinate transforms, auto-fit logic, dynamic bar width,
// and future-ready log-scale / percent-scale modes.
//
// FM-SCALE-001

export class ScaleEngine {
  constructor() {
    this.padding = {
      top: 12,
      bottom: 12,
      left: 10,
      right: 10,
    };

    this.minBarWidth = 2.5;
    this.maxBarWidth = 24;

    this.logMode = false;
  }

  /**
   * Convert price → Y coordinate (in pixels).
   */
  priceToY(price, minPrice, maxPrice, height) {
    if (this.logMode) {
      const logMin = Math.log(minPrice);
      const logMax = Math.log(maxPrice);
      const logP = Math.log(price);

      const t = (logP - logMin) / (logMax - logMin);
      return (
        this.padding.top +
        (1 - t) * (height - this.padding.top - this.padding.bottom)
      );
    }

    const t = (price - minPrice) / (maxPrice - minPrice);
    return (
      this.padding.top +
      (1 - t) * (height - this.padding.top - this.padding.bottom)
    );
  }

  /**
   * Convert Y pixel → price value.
   */
  yToPrice(yPx, minPrice, maxPrice, height) {
    const chartHeight = height - this.padding.top - this.padding.bottom;
    const t = 1 - (yPx - this.padding.top) / chartHeight;
    const p = minPrice + t * (maxPrice - minPrice);
    return p;
  }

  /**
   * Compute the min/max price from a visible slice.
   */
  computeRange(data) {
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (!b) continue;
      if (b.l < minPrice) minPrice = b.l;
      if (b.h > maxPrice) maxPrice = b.h;
    }

    if (!isFinite(minPrice) || !isFinite(maxPrice)) {
      minPrice = 0;
      maxPrice = 1;
    }

    if (minPrice === maxPrice) {
      minPrice -= 0.5;
      maxPrice += 0.5;
    }

    return { minPrice, maxPrice };
  }

  /**
   * Compute the pixel width of each bar.
   */
  computeBarWidth(totalWidth, barCount) {
    const core = totalWidth - (this.padding.left + this.padding.right);
    const bw = core / Math.max(1, barCount);
    return Math.min(this.maxBarWidth, Math.max(this.minBarWidth, bw));
  }

  /**
   * Compute the X-center of a bar.
   */
  barIndexToX(i, barWidth) {
    return this.padding.left + (i + 0.5) * barWidth;
  }

  /**
   * Compute bar index from pixel coordinate.
   */
  xToBarIndex(px, barWidth) {
    return (px - this.padding.left) / barWidth - 0.5;
  }
}
