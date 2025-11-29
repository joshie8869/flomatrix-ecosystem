 // app/main.js
 // FloMatrix front-end shell + FloEngine WebGL init + FULL DrawingEngine + FULL InteractionEngine
 // + Symbol/AssetClass/Timeframe router, Price Rail from SAMPLE_OHLC
 // FloMatrix v3.5 — Institutional Front-End Core
 //
 // FM-FRONTEND-CORE-001
 
 import { initFloEngine } from "./engine/core/engine-core.js";
 import { SAMPLE_OHLC } from "./engine/core/sample-ohlc.js";
 import { ChartRouter } from "./engine/router/chart-router.js";
 import { DrawingEngine } from "./engine/drawings/drawing-engine.js";
 import { InteractionEngine } from "./engine/interactions/interaction-engine.js";
 import { ScaleEngine } from "./engine/scales/scale-engine.js";
 
 // ------------------------------------------------------
 // 1. GLOBAL FRONT-END STATE
 // ------------------------------------------------------
 const fmState = {
   symbol: "BTCUSD",
   assetClass: "crypto",
   venue: "BINANCE",
   sessionLabel: "UTC • Session: Crypto",
   timeframe: "5m",
 };
 
 let floEngine = null;
 let drawingEngine = null;
 let interactionEngine = null;
 let scaleEngine = null;
 let router = null;
 
 let currentTool = "cursor";
 
 // ------------------------------------------------------
 // 2. SYMBOL / TIMEFRAME REGISTRY
 // ------------------------------------------------------
 
 const FM_SYMBOL_REGISTRY = {
   BTCUSD: { id: "BTCUSD", assetClass: "crypto", venue: "BINANCE", sessionLabel: "UTC • Session: Crypto" },
   ETHUSD: { id: "ETHUSD", assetClass: "crypto", venue: "BINANCE", sessionLabel: "UTC • Session: Crypto" },
   SOLUSD: { id: "SOLUSD", assetClass: "crypto", venue: "BINANCE", sessionLabel: "UTC • Session: Crypto" },
   ES: { id: "ES", assetClass: "futures", venue: "CME", sessionLabel: "UTC • Session: US Index Futures" },
   NQ: { id: "NQ", assetClass: "futures", venue: "CME", sessionLabel: "UTC • Session: US Index Futures" },
   CL: { id: "CL", assetClass: "futures", venue: "NYMEX", sessionLabel: "UTC • Session: Energy Futures" },
 };
 
 const FM_TIMEFRAME_REGISTRY = {
   "15s": { id: "15s", label: "15s / 30s", axisLabel: "Time axis – 15s / 30s" },
   "1m": { id: "1m", label: "1m / 3m", axisLabel: "Time axis – 1m / 3m" },
   "5m": { id: "5m", label: "5m", axisLabel: "Time axis – 5m" },
   "15m": { id: "15m", label: "15m", axisLabel: "Time axis – 15m" },
   "1h": { id: "1h", label: "1h", axisLabel: "Time axis – 1h" },
   "4h": { id: "4h", label: "4h", axisLabel: "Time axis – 4h" },
   "1D": { id: "1D", label: "1D", axisLabel: "Time axis – 1D" },
 };
 
 // ------------------------------------------------------
 // 3. MENU SETUP
 // ------------------------------------------------------
 
 function setupMenus() {
   setupMarketsMenu();
   setupTimeframesMenu();
   applySymbolStateToUI();
   applyTimeframeStateToUI();
   updatePriceRailFromSample();
 }
 
 function setupMarketsMenu() {
   const opts = document.querySelectorAll(".fm-menu-option[data-symbol]");
   opts.forEach((opt) => {
     opt.addEventListener("click", () => {
       const id = opt.dataset.symbol;
       const def = FM_SYMBOL_REGISTRY[id];
       if (!def) return;
 
       fmState.symbol = def.id;
       fmState.assetClass = def.assetClass;
       fmState.venue = def.venue;
       fmState.sessionLabel = def.sessionLabel;
 
       applySymbolStateToUI();
       updatePriceRailFromSample();
       notifyEngineSymbolChange();
     });
   });
 }
 
 function setupTimeframesMenu() {
   const opts = document.querySelectorAll(".fm-menu-option[data-timeframe]");
   opts.forEach((opt) => {
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
   const s = document.getElementById("fm-symbol");
   const pill = document.getElementById("fm-session-pill");
   if (s) s.textContent = fmState.symbol;
   if (pill) pill.textContent = fmState.sessionLabel;
 }
 
 function applyTimeframeStateToUI() {
   const tfDef = FM_TIMEFRAME_REGISTRY[fmState.timeframe];
   const tfLabel = tfDef ? tfDef.label : fmState.timeframe;
   const axisLabel = tfDef ? tfDef.axisLabel : `Time axis – ${fmState.timeframe}`;
 
   const tfSpan = document.getElementById("fm-symbol-tf");
   const axis = document.getElementById("fm-time-axis-label");
 
   if (tfSpan) tfSpan.textContent = "paper";  
   if (axis) axis.textContent = axisLabel;
 }
 
 function notifyEngineSymbolChange() {
   if (floEngine && floEngine.setSymbol) {
     floEngine.setSymbol({
       symbol: fmState.symbol,
       assetClass: fmState.assetClass,
       venue: fmState.venue,
     });
   }
 }
 
 function notifyEngineTimeframeChange() {
   if (floEngine && floEngine.setTimeframe) {
     floEngine.setTimeframe(fmState.timeframe);
   }
 }
 
 // ------------------------------------------------------
 // 4. TOOLBAR + DRAWING ENGINE
 // ------------------------------------------------------
 
 function setupToolbar() {
   const btns = document.querySelectorAll(".fm-tool-button");
 
   btns.forEach((btn) => {
     btn.addEventListener("click", (e) => {
       e.stopPropagation();
       const tool = btn.dataset.tool;
 
       btns.forEach((b) => b.classList.remove("active"));
 
       if (tool === "clear") {
         if (drawingEngine) drawingEngine.clearAll();
         return;
       }
 
       currentTool = tool;
       btn.classList.add("active");
 
       if (drawingEngine) drawingEngine.setTool(tool);
       updateOverlayPointerEvents();
     });
   });
 }
 
 function updateOverlayPointerEvents() {
   const overlay = document.getElementById("flo-overlay-canvas");
   if (!overlay) return;
 
   if (currentTool === "cursor") overlay.style.pointerEvents = "none";
   else overlay.style.pointerEvents = "auto";
 }
 
 // ------------------------------------------------------
 // 5. PRICE RAIL (SAMPLE DATA)
 // ------------------------------------------------------
 
 function updatePriceRailFromSample() {
   if (!SAMPLE_OHLC.length) return;
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
 
   const bid = lastClose - 15;
   const ask = lastClose + 15;
 
   if (bidEl) bidEl.textContent = bid.toLocaleString();
   if (askEl) askEl.textContent = ask.toLocaleString();
 }
 
 // ------------------------------------------------------
 // 6. BOOTSTRAP — FULL SYSTEM WIRING
 // ------------------------------------------------------
 
 function bootstrap() {
   try {
     floEngine = initFloEngine("flo-chart-canvas") || null;
   } catch (err) {
     console.error("[FloMatrix] initFloEngine error:", err);
     floEngine = null;
   }
 
   scaleEngine = new ScaleEngine();
 
   setupMenus();
   setupToolbar();
 
   const chartCanvas = document.getElementById("flo-chart-canvas");
   const overlayCanvas = document.getElementById("flo-overlay-canvas");
 
   drawingEngine = new DrawingEngine(overlayCanvas, floEngine, scaleEngine);
 
   interactionEngine = new InteractionEngine(
     chartCanvas,
     floEngine.getState(),
     scaleEngine,
     () => floEngine.update()
   );
 
   router = new ChartRouter(floEngine);
 
   updateOverlayPointerEvents();
 }
 
 document.addEventListener("DOMContentLoaded", bootstrap);
