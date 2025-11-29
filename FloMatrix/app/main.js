// app/main.js
// FloMatrix front-end shell + FloEngine WebGL init + R:R overlay
// + Symbol / asset-class / timeframe state & menu wiring
// + Price rail + session labels driven from SAMPLE_OHLC
//
// FM-FRONTEND-CORE-001

import { initFloEngine } from "./engine/core/engine-core.js";
import { SAMPLE_OHLC } from "./engine/core/sample-ohlc.js";

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

// optional future hooks into FloEngine (if engine-core returns an object)
let floEngine = null;

let currentTool = "cursor";

// simple in-memory RR objects
const rrBoxes = [];
let activeRR = null;

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
// 3. TOP MENUS → STATE
// -----------------------------

function setupMenus() {
  setupMarketsMenu();
  setupTimeframesMenu();
  applySymbolStateToUI();
  applyTimeframeStateToUI();
  updatePriceRailFromSample();
}

function setupMarketsMenu() {
  const marketOptions = document.querySelectorAll(".fm-menu-option[data-symbol]");
  marketOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const symbolId = opt.dataset.symbol;
      const assetClass = opt.dataset.assetClass || "crypto";
      const venue = opt.dataset.venue || "BINANCE";
      const sessionLabel =
        opt.dataset.sessionLabel || "UTC • Session: Crypto";

      const def = FM_SYMBOL_REGISTRY[symbolId];
      fmState.symbol = def ? def.id : symbolId;
      fmState.assetClass = def ? def.assetClass : assetClass;
      fmState.venue = def ? def.venue : venue;
      fmState.sessionLabel = def ? def.sessionLabel : sessionLabel;

      applySymbolStateToUI();
      updatePriceRailFromSample();
      notifyEngineSymbolChange();
    });
  });
}

function setupTimeframesMenu() {
  const tfOptions = document.querySelectorAll(".fm-menu-option[data-timeframe]");
  tfOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      const tf = opt.dataset.timeframe;
      if (!tf) return;
      fmState.timeframe = tf;
      applyTimeframeStateToUI();
      notifyEngineTimeframeChange();
      // price rail stays same numerically for now; visual scale will come from engine
    });
  });
}

function applySymbolStateToUI() {
  const symbolSpan = document.getElementById("fm-symbol");
  const sessionPill = document.getElementById("fm-session-pill");

  if (symbolSpan) {
    symbolSpan.textContent = fmState.symbol;
  }
  if (sessionPill) {
    sessionPill.textContent = fmState.sessionLabel;
  }
}

function applyTimeframeStateToUI() {
  const tfDef = FM_TIMEFRAME_REGISTRY[fmState.timeframe];
  const tfLabel = tfDef ? tfDef.label : fmState.timeframe;
  const axisLabel = tfDef ? tfDef.axisLabel : `Time axis – ${fmState.timeframe}`;

  const tfSpan = document.getElementById("fm-symbol-tf");
  const axisLabelEl = document.getElementById("fm-time-axis-label");

  if (tfSpan) {
    // still show "paper" mode but append timeframe for debugging if desired
    tfSpan.textContent = "paper";
  }
  if (axisLabelEl) {
    axisLabelEl.textContent = axisLabel;
  }
}

function notifyEngineSymbolChange() {
  if (floEngine && typeof floEngine.setSymbol === "function") {
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
}

function notifyEngineTimeframeChange() {
  if (floEngine && typeof floEngine.setTimeframe === "function") {
    try {
      floEngine.setTimeframe(fmState.timeframe);
    } catch (err) {
      console.warn("[FloMatrix] floEngine.setTimeframe error:", err);
    }
  }
}

// -----------------------------
// 4. TOOLBAR + TEXT DRAWER
// -----------------------------

function setupToolbar() {
  const buttons = document.querySelectorAll(".fm-tool-button");
  const textDrawer = document.getElementById("fm-text-drawer");

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tool = btn.getAttribute("data-tool");

      // reset active state
      buttons.forEach((b) => b.classList.remove("active"));

      if (tool === "text") {
        const visible = textDrawer.classList.toggle("visible");
        currentTool = visible ? "text" : "cursor";
        if (visible) btn.classList.add("active");
      } else {
        if (textDrawer) textDrawer.classList.remove("visible");
        currentTool = tool;
        btn.classList.add("active");
      }

      console.log("[FloMatrix] Tool selected:", currentTool);
      updateOverlayPointerEvents();
    });
  });

  // clicking outside toolbar closes drawer & resets text tool
  document.addEventListener("click", (e) => {
    const toolbar = document.querySelector(".fm-left-toolbar");
    if (toolbar && !toolbar.contains(e.target)) {
      if (textDrawer) textDrawer.classList.remove("visible");
      if (currentTool === "text") currentTool = "cursor";
      const buttonsAll = document.querySelectorAll(".fm-tool-button");
      buttonsAll.forEach((b) => b.classList.remove("active"));
      updateOverlayPointerEvents();
    }
  });
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

  // fake tight spread around last for now
  const bid = lastClose - 15;
  const ask = lastClose + 15;

  if (bidEl) bidEl.textContent = bid.toLocaleString();
  if (askEl) askEl.textContent = ask.toLocaleString();
}

/* ----------------- R:R OVERLAY ENGINE ----------------- */

function updateOverlayPointerEvents() {
  const overlay = document.getElementById("flo-overlay-canvas");
  if (!overlay) return;

  // only capture mouse when using R:R or drawing tools later
  if (currentTool === "rr") {
    overlay.style.pointerEvents = "auto";
  } else {
    overlay.style.pointerEvents = "none";
  }
}

function initRROverlay() {
  const overlay = document.getElementById("flo-overlay-canvas");
  const baseCanvas = document.getElementById("flo-chart-canvas");
  if (!overlay || !baseCanvas) return;

  const ctx = overlay.getContext("2d");

  function resize() {
    const rect = baseCanvas.getBoundingClientRect();
    overlay.width = rect.width * window.devicePixelRatio;
    overlay.height = rect.height * window.devicePixelRatio;
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    ctx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0
    );
    redrawRR(ctx);
  }

  window.addEventListener("resize", resize);
  resize();

  let isDragging = false;

  overlay.addEventListener("mousedown", (e) => {
    if (currentTool !== "rr") return;
    isDragging = true;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    activeRR = {
      xStart: x,
      yEntry: y,
      xEnd: x,
      yStop: y + 60, // initial guess
      direction: "long", // future: infer from drag
    };
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!isDragging || currentTool !== "rr" || !activeRR) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    activeRR.xEnd = x;
    activeRR.yStop = y;

    redrawRR(ctx);
  });

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;

    if (activeRR) {
      rrBoxes.push(activeRR);
      activeRR = null;
      redrawRR(ctx);
    }
  }

  overlay.addEventListener("mouseup", endDrag);
  overlay.addEventListener("mouseleave", () => {
    if (!isDragging) return;
    endDrag();
  });

  // clear drawings tool
  const clearButton = document.querySelector(
    '.fm-tool-button[data-tool="clear"]'
  );
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      rrBoxes.length = 0;
      activeRR = null;
      redrawRR(ctx);
    });
  }
}

function redrawRR(ctx) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const all = [...rrBoxes];
  if (activeRR) all.push(activeRR);

  all.forEach((rr) => drawSingleRR(ctx, rr));
}

function drawSingleRR(ctx, rr) {
  const { xStart, xEnd, yEntry, yStop, direction } = rr;

  const xLeft = Math.min(xStart, xEnd);
  const xRight = Math.max(xStart, xEnd);
  const midX = (xLeft + xRight) / 2;

  // risk segment between entry & stop
  const riskTop = Math.min(yEntry, yStop);
  const riskBottom = Math.max(yEntry, yStop);
  const riskHeight = riskBottom - riskTop;

  // set simple 1:2 target visualization above/below entry
  const targetHeight = riskHeight * 2;
  let targetTop, targetBottom;

  if (direction === "long") {
    // risk below entry, target above
    if (yStop > yEntry) {
      // normal case
      targetBottom = yEntry - 4;
      targetTop = targetBottom - targetHeight;
    } else {
      // dragged upwards, flip direction
      targetTop = yEntry + 4;
      targetBottom = targetTop + targetHeight;
    }
  } else {
    // short (future extension)
    if (yStop < yEntry) {
      targetTop = yEntry + 4;
      targetBottom = targetTop + targetHeight;
    } else {
      targetBottom = yEntry - 4;
      targetTop = targetBottom - targetHeight;
    }
  }

  // RISK box (red)
  ctx.save();
  ctx.fillStyle = "rgba(255,77,107,0.16)";
  ctx.strokeStyle = "rgba(255,77,107,0.9)";
  ctx.lineWidth = 1.2;
  roundedRect(ctx, xLeft, riskTop, xRight - xLeft, riskHeight, 4);
  ctx.fill();
  ctx.stroke();

  // TARGET box (green)
  ctx.fillStyle = "rgba(46,242,126,0.12)";
  ctx.strokeStyle = "rgba(46,242,126,0.9)";
  roundedRect(
    ctx,
    xLeft,
    targetTop,
    xRight - xLeft,
    targetBottom - targetTop,
    4
  );
  ctx.fill();
  ctx.stroke();

  // ENTRY line
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(xLeft - 6, yEntry);
  ctx.lineTo(xRight + 6, yEntry);
  ctx.stroke();
  ctx.setLineDash([]);

  // R:R label (currently 1:2)
  const label = "R:R 1 : 2";
  const labelWidth = ctx.measureText(label).width + 10;
  const labelX = midX - labelWidth / 2;
  const labelY = targetTop < riskTop ? targetTop - 6 : riskTop - 6;

  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  roundedRect(ctx, labelX, labelY - 12, labelWidth, 16, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e7f2ff";
  ctx.font = "10px system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelX + 5, labelY - 4);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/* ----------------- BOOTSTRAP ----------------- */

function bootstrap() {
  // 1) Start WebGL engine in the base canvas
  try {
    floEngine = initFloEngine("flo-chart-canvas") || null;
  } catch (err) {
    console.error("[FloMatrix] initFloEngine error:", err);
    floEngine = null;
  }

  // 2) Wire up menus (markets + timeframes)
  setupMenus();

  // 3) Wire up left toolbar + text drawer
  setupToolbar();

  // 4) R:R overlay on top canvas
  initRROverlay();
  updateOverlayPointerEvents();
}

document.addEventListener("DOMContentLoaded", bootstrap);
