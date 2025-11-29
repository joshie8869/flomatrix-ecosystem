// app/engine/router/chart-router.js
// FloEngine v3.0 — Chart Router
// Centralized router that translates UI menu selections
// into engine state changes.
//
// FM-ROUTER-001

export class ChartRouter {
  constructor(engine) {
    this.engine = engine;

    this._bindSymbolMenu();
    this._bindTimeframeMenu();
  }

  // ------------------------------
  // SYMBOL MENU
  // ------------------------------
  _bindSymbolMenu() {
    document.querySelectorAll(".fm-menu-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const name = opt.textContent.trim().split(/\s+/)[0];

        // We map basic symbol → asset-class for now.
        const mapping = {
          BTCUSD: { symbol: "BTCUSD", assetClass: "crypto", venue: "BINANCE" },
          ETHUSD: { symbol: "ETHUSD", assetClass: "crypto", venue: "BINANCE" },
          SOLUSD: { symbol: "SOLUSD", assetClass: "crypto", venue: "BINANCE" },

          ES: { symbol: "ES", assetClass: "futures", venue: "CME" },
          NQ: { symbol: "NQ", assetClass: "futures", venue: "CME" },
          CL: { symbol: "CL", assetClass: "futures", venue: "NYMEX" },
        };

        const cfg = mapping[name];
        if (!cfg) return;

        this.engine.setSymbol(cfg);

        // Update the symbol pill
        const pill = document.getElementById("fm-symbol");
        if (pill) pill.textContent = cfg.symbol;

        this.engine.update();
      });
    });
  }

  // ------------------------------
  // TIMEFRAME MENU
  // ------------------------------
  _bindTimeframeMenu() {
    const tfOptions = [
      "15s", "30s",
      "1m", "3m", "5m",
      "15m", "1h", "4h", "1D"
    ];

    document.querySelectorAll(".fm-menu-option").forEach((opt) => {
      const t = opt.textContent.trim();
      if (!tfOptions.includes(t)) return;

      opt.addEventListener("click", () => {
        this.engine.setTimeframe(t);

        const tf = document.querySelector(".fm-symbol-tf");
        if (tf) tf.textContent = t;

        this.engine.update();
      });
    });
  }
}
