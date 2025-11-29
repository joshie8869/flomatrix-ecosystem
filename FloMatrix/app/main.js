// app/main.js
// FloMatrix front-end shell + FloEngine WebGL init
// + Symbol / asset-class / timeframe state & menu wiring
// + Price rail from SAMPLE_OHLC
// + DrawingEngine (trend / hline / box / text / R:R / clear)
//
// FM-FRONTEND-CORE-002

import { initFloEngine } from "./engine/core/engine-core.js";
import { SAMPLE_OHLC } from "./engine/core/sample-ohlc.js";
import { ScaleEngine } from "./engine/scales/scale-engine.js";
import { DrawingEngine } from "./engine/drawings/drawing-engine.js";

// -----------------------------
// 1. GLOBAL STATE
// -----------------------------

const fmState = {
  symbol: "BTCUSD",
  assetClass: "crypto",
  venue: "BINANCE",
  sessionLabel: "UTC • Session: Crypto",
  timeframe: "5m",
};

let floEngine = null;
let drawingEngine = null;
let scaleEngine = null;

let currentTool = "cursor";

// -----------------------------
// 2. SYMBOL / TIMEFRAME REGISTRY
// -----------------------------

const FM_SYMBOL_REGISTRY = {
  BTCUSD: {
    id: "BTCUSD",
    label: "BTCUSD",
    assetClass: "crypto",
    venue: "BINANCE",
    sessionLabel: "UTC • Session: Crypto",
  },
  ETHUSD: {
    id: "ETHUSD",
    label: "ETHUSD",
    assetClass: "crypto",
    venue: "BINANCE",
    sessionLabel: "UTC • Session: Crypto",
  },
  SOLUSD: {
    id: "SOLUSD",
    label: "SOLUSD",
    assetClass: "crypto",
    venue: "BINANCE",
    sessionLabel: "UTC • Session: Crypto",
  },
  ES: {
    id: "ES",
    label: "ES",
    assetClass: "futures",
    venue: "CME",
    sessionLabel: "UTC • Session: US Index Futures",
  },
  NQ: {
    id: "NQ",
    label: "NQ",
    assetClass: "futures",
    venue: "CME",
    sessionLabel: "UTC • Session: US Index Futures",
  },
  CL: {
    id: "CL",
    label: "CL",
    assetClass: "futures",
    venue: "NYMEX",
    sessionLabel: "UTC • Session: Energy Futures",
  },
};

const FM_TIMEFRAME_REGISTRY = {
  "15s": {
    id: "15s",
    label: "15s / 30s",
    axisLabel: "Time axis – 15s / 30s",
  },
  "1m": {
    id: "1m",
    label: "1m / 3m",
    axisLabel: "Time axis – 1m / 3m",
  },
  "5m": {
    id: "5m",
    label: "5m",
    axisLabel: "Time axis – 5m",
  },
  "15m": {
    id: "15m",
    label: "15m",
    axisLabel: "Time axis – 15m",
  },
  "1h": {
    id: "1h",
    label: "1h",
    axisLabel: "Time axis – 1h",
  },
  "4h": {
    id: "4h",
    label: "4h",
    axisLabel: "Time axis – 4h",
  },
  "1D": {
    id: "1D",
    label: "1D",
    axisLabel: "Time axis – 1D",
  },
};

// -----------------------------
// 3. MENUS → STATE → ENGINE
// -----------------------------

function setupMenus() {
  setupMarketsMenu();
  setupTimeframesMenu();
  applySymbolStateToUI();
  applyTimeframeStateToUI();
  updatePriceRailFromSample();
}

function setupMarketsMenu() {
  const marketOptions = document.querySelectorAll(
    ".fm-menu-item:nth-child(1) .fm-menu-option[data-symbol]"
  );

  marketOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const symbolId = opt.dataset.symbol;
      const def = FM_SYMBOL_REGISTRY[symbolId];

      if (def) {
        fmState.symbol = def.id;
        fmState.assetClass = def.assetClass;
        fmState.venue = def.venue;
        fmState.sessionLabel = def.sessionLabel;
      } else {
        fmState.symbol = symbolId || fmState.symbol;
        fmState.assetClass = opt.dataset.assetClass || fmState.assetClass;
        fmState.venue = opt.dataset.venue || fmState.venue;
        fmState.sessionLabel =
          opt.dataset.sessionLabel || fmState.sessionLabel;
      }

      applySymbolStateToUI();
      updatePriceRailFromSample();
      notifyEngineSymbolChange();
    });
  });
}

function setupTimeframesMenu() {
  const tfOptions = document.querySelectorAll(
    ".fm-menu-item:nth-child(2) .fm-menu-option[data-timeframe]"
  );

  tfOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const tf = opt.dataset.timeframe;
      if (!tf) return;

      fmState.timeframe = tf;
      applyTimeframeStateToUI();
      notifyEngineTimeframeChange();
    });
  });
}

function applySymbolStateToUI() {
  const symbolSpan = document.getElementById("fm-symbol");
  const sessionPill = document.getElementById("fm-session-pill");

  if (symbolSpan) symbolSpan.textContent = fmState.symbol;
  if (sessionPill) sessionPill.textContent = fmState.sessionLabel;
}

function applyTimeframeStateToUI() {
  const tfDef = FM_TIMEFRAME_REGISTRY[fmState.timeframe];
  const axisLabel = tfDef
    ? tfDef.axisLabel
    : `Time axis – ${fmState.timeframe}`;

  const tfSpan = document.getElementById("fm-symbol-tf");
  const axisLabelEl = document.getElementById("fm-time-axis-label");

  if (tfSpan) tfSpan.textContent = "paper"; // keep current pill label
  if (axisLabelEl) axisLabelEl.textContent = axisLabel;
}

function notifyEngineSymbolChange() {
  if (!floEngine || typeof floEngine.setSymbol !== "function") return;

  try {
    floEngine.setSymbol({
      symbol: fmState.symbol,
      assetClass: fmState.assetClass,
      venue: fmState.venue,
    });
  } catch (err) {
    console.warn("[FloMatrix] floEngine.setSymbol error:", err);
  }
}

function notifyEngineTimeframeChange() {
  if (!floEngine || typeof floEngine.setTimeframe !== "function") return;

  try {
    floEngine.setTimeframe(fmState.timeframe);
  } catch (err) {
    console.warn("[FloMatrix] floEngine.setTimeframe error:", err);
  }
}

// -----------------------------
// 4. TOOLBAR + DRAWING ENGINE
// -----------------------------

function setupToolbar() {
  const buttons = document.querySelectorAll(".fm-tool-button");
  const textDrawer = document.getElementById("fm-text-drawer");

  function setActiveButton(targetTool) {
    buttons.forEach((b) => {
      const t = b.getAttribute("data-tool");
      if (t === targetTool) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tool = btn.getAttribute("data-tool");

      if (tool === "cursor") {
        currentTool = "cursor";
        if (textDrawer) textDrawer.classList.remove("visible");
        if (drawingEngine) drawingEngine.setTool(null);
      } else if (tool === "clear") {
        currentTool = "cursor";
        if (textDrawer) textDrawer.classList.remove("visible");
        if (drawingEngine) drawingEngine.clearAll();
        if (drawingEngine) drawingEngine.setTool(null);
      } else if (tool === "text") {
        currentTool = "text";
        if (textDrawer) {
          const visible = !textDrawer.classList.contains("visible");
          if (visible) {
            textDrawer.classList.add("visible");
          } else {
            textDrawer.classList.remove("visible");
            currentTool = "cursor";
          }
        }
        if (drawingEngine) drawingEngine.setTool(currentTool === "cursor" ? null : "text");
      } else {
        // drawing tools: trend, hline, box, rr
        currentTool = tool;
        if (textDrawer) textDrawer.classList.remove("visible");
        if (drawingEngine) drawingEngine.setTool(tool);
      }

      setActiveButton(currentTool === "cursor" ? null : currentTool);
      updateOverlayPointerEvents();
    });
  });

  // clicking outside toolbar closes drawer, resets text tool
  document.addEventListener("click", (e) => {
    const toolbar = document.querySelector(".fm-left-toolbar");
    if (!toolbar) return;
    if (!toolbar.contains(e.target)) {
      if (textDrawer) textDrawer.classList.remove("visible");
      if (currentTool === "text") {
        currentTool = "cursor";
        if (drawingEngine) drawingEngine.setTool(null);
        setActiveButton(null);
        updateOverlayPointerEvents();
      }
    }
  });
}

// enable overlay mouse only for drawing tools
function updateOverlayPointerEvents() {
  const overlay = document.getElementById("flo-overlay-canvas");
  if (!overlay) return;

  const drawingTools = ["trend", "hline", "box", "text", "rr"];
  if (drawingTools.includes(currentTool)) {
    overlay.style.pointerEvents = "auto";
  } else {
    overlay.style.pointerEvents = "none";
  }
}

// -----------------------------
// 5. PRICE RAIL FROM SAMPLE DATA
// -----------------------------

function updatePriceRailFromSample() {
  if (!Array.isArray(SAMPLE_OHLC) || SAMPLE_OHLC.length === 0) return;

  const last = SAMPLE_OHLC[SAMPLE_OHLC.length - 1];
  const first = SAMPLE_OHLC[0];

  const lastPriceEl = document.getElementById("fm-last-price");
  const changeEl = document.getElementById("fm-last-change");
  const bidEl = document.getElementById("fm-bid");
  const askEl = document.getElementById("fm-ask");

  const lastClose = last.c;
  const firstClose = first.c;
  const changePct = ((lastClose - firstClose) / firstClose) * 100;

  if (lastPriceEl) {
    lastPriceEl.textContent = lastClose.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (changeEl) {
    const sign = changePct >= 0 ? "+" : "";
    changeEl.textContent = `${sign}${changePct.toFixed(2)}%`;
  }

  const spread = 15;
  const bid = lastClose - spread;
  const ask = lastClose + spread;

  if (bidEl) bidEl.textContent = bid.toLocaleString();
  if (askEl) askEl.textContent = ask.toLocaleString();
}

// -----------------------------
// 6. BOOTSTRAP
// -----------------------------

function bootstrap() {
  // 1) Start WebGL engine
  try {
    floEngine = initFloEngine("flo-chart-canvas") || null;
  } catch (err) {
    console.error("[FloMatrix] initFloEngine error:", err);
    floEngine = null;
  }

  // 2) Scale + DrawingEngine wiring
  const overlayCanvas = document.getElementById("flo-overlay-canvas");
  if (overlayCanvas && floEngine) {
    scaleEngine = new ScaleEngine();
    drawingEngine = new DrawingEngine(overlayCanvas, floEngine, scaleEngine);
  } else {
    console.warn("[FloMatrix] DrawingEngine not initialized (missing canvas or engine).");
  }

  // 3) Menus
  setupMenus();

  // 4) Toolbar + tools
  setupToolbar();
  updateOverlayPointerEvents();
}

document.addEventListener("DOMContentLoaded", bootstrap);
