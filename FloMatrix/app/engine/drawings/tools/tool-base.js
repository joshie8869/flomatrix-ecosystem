// app/engine/drawings/tools/tool-base.js
// Base class every drawing tool extends.
// Defines shared helpers, coordinate transforms, etc.
//
// FM-TOOL-BASE-001

export class ToolBase {
  constructor(engine, scaleEngine) {
    this.engine = engine;
    this.scale = scaleEngine;
  }

  // ---------------------------------
  // OVERRIDABLES (subclasses override)
  // ---------------------------------
  onStart(x, y) {}
  onMove(x, y, obj) {}
  onEnd(x, y, obj) {}

  // ---------------------------------
  // INTERNAL HELPERS
  // ---------------------------------

  /**
   * Retrieve visible data + min/max from engine safely.
   */
  _getPriceRange() {
    const state = this.engine.getState();
    const visible = state.data;

    const { minPrice, maxPrice } = this.scale.computeRange(visible);
    return { minPrice, maxPrice };
  }

  /**
   * Determine viewport height from renderer or fallback.
   */
  _getViewportHeight() {
    const s = this.engine.getState();
    return (
      s.viewportHeight ||
      this.engine.viewportHeight ||
      800 // fallback
    );
  }

  /**
   * Pixel Y → price
   */
  yToPrice(yPx) {
    const { minPrice, maxPrice } = this._getPriceRange();
    const viewportH = this._getViewportHeight();

    return this.scale.yToPrice(yPx, minPrice, maxPrice, viewportH);
  }

  /**
   * Price → pixel Y
   */
  priceToY(price) {
    const { minPrice, maxPrice } = this._getPriceRange();
    const viewportH = this._getViewportHeight();

    return this.scale.priceToY(price, minPrice, maxPrice, viewportH);
  }
}
