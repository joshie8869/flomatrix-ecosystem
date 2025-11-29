// app/chart.js
// FloMatrix Prototype Candle Engine v1.0
// - AnyChart stock chart
// - Candles + time axis
// - Asset class, symbol, venue selectors
// - Price scale mode
// - Pan / zoom / drag interactions

// FM-CHART-PROTOTYPE-001

// -----------------------------
// 1. BASIC SYMBOL UNIVERSE
// -----------------------------

const FM_SYMBOLS = [
  {
    id: "BTCUSDT",
    label: "BTC/USDT",
    assetClass: "crypto",
    venue: "BINANCE",
    displayVenue: "BINANCE",
  },
  {
    id: "ETHUSDT",
    label: "ETH/USDT",
    assetClass: "crypto",
    venue: "BINANCE",
    displayVenue: "BINANCE",
  },
  {
    id: "ES_F",
    label: "ES (E-Mini S&P Futures)",
    assetClass: "futures",
    venue: "CME",
    displayVenue: "CME",
  },
  {
    id: "NQ_F",
    label: "NQ (Nasdaq-100 Futures)",
    assetClass: "futures",
    venue: "CME",
    displayVenue: "CME",
  },
  {
    id: "SPX",
    label: "S&P 500 Index",
    assetClass: "index",
    venue: "CBOE",
    displayVenue: "CBOE",
  },
  {
    id: "AAPL",
    label: "AAPL",
    assetClass: "equity",
    venue: "NASDAQ",
    displayVenue: "NASDAQ",
  },
  {
    id: "EURUSD",
    label: "EUR/USD",
    assetClass: "forex",
    venue: "FX",
    displayVenue: "Global FX",
  },
];

const FM_TIMEFRAMES = ["1D", "5D", "1M", "3M", "6M", "1Y", "ALL"];

// -----------------------------
// 2. PROTOTYPE DATA GENERATOR
// -----------------------------

/**
 * Generate prototype OHLCV data.
 * This is intentionally generic — the exact instrument
 * does not matter at this stage. We just need stable candles.
 *
 * Returns array of:
 * [dateString, open, high, low, close, volume]
 */
function generatePrototypeData({
  bars = 300,
  startPrice = 30000,
  volatility = 0.02,
}) {
  const out = [];
  let current = startPrice;

  const now = new Date();
  // go back "bars" days
  const start = new Date(now.getTime() - bars * 24 * 60 * 60 * 1000);

  for (let i = 0; i < bars; i++) {
    const t = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);

    const drift = (Math.random() - 0.5) * volatility * current;
    const open = current;
    const close = Math.max(10, current + drift);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000 + Math.random() * 8000;

    current = close;

    const dateStr = t.toISOString().slice(0, 10); // YYYY-MM-DD

    out.push([dateStr, open, high, low, close, volume]);
  }

  return out;
}

// Single global prototype dataset shared by all symbols for now.
const FM_PROTOTYPE_DATA = generatePrototypeData({
  bars: 400,
  startPrice: 30000,
  volatility: 0.03,
});

// -----------------------------
// 3. ANYCHART INITIALIZATION
// -----------------------------

let fmChart = null;
let fmPlot = null;
let fmDataTable = null;
let fmCandlesMapping = null;
let fmVolumeMapping = null;
let fmCandleSeries = null;
let fmVolumeSeries = null;

let fmCurrentSymbol = FM_SYMBOLS[0]; // BTCUSDT default
let fmCurrentTimeframe = "5D";

anychart.onDocumentReady(function () {
  // 3.1 Create data table + mappings
  fmDataTable = anychart.data.table(0);
  fmDataTable.addData(FM_PROTOTYPE_DATA);

  fmCandlesMapping = fmDataTable.mapAs({
    open: 1,
    high: 2,
    low: 3,
    close: 4,
  });

  fmVolumeMapping = fmDataTable.mapAs({
    value: 5,
  });

  // 3.2 Stock chart base
  fmChart = anychart.stock();
  fmChart.padding(8, 16, 8, 8);

  // 3.3 First plot: candles
  fmPlot = fmChart.plot(0);
  fmPlot.yGrid(true).xGrid(true);

  fmCandleSeries = fmPlot.candlestick(fmCandlesMapping);
  fmCandleSeries.name("Prototype");

  // neon-ish colors
  fmCandleSeries.risingStroke("#26ff88", 1.4);
  fmCandleSeries.risingFill("#26ff88 0.7");
  fmCandleSeries.fallingStroke("#ff4d88", 1.4);
  fmCandleSeries.fallingFill("#ff4d88 0.7");

  fmPlot.background().fill("#050810");
  fmPlot.yAxis().labels().fontColor("#cbd4ff");
  fmPlot.xAxis().labels().fontColor("#8a93b5");
  fmPlot.yAxis().orientation("right");
  fmPlot.crosshair().enabled(true).displayMode("sticky");
  fmPlot.crosshair().yLabel().fontColor("#ffffff");
  fmPlot.crosshair().xLabel().fontColor("#ffffff");

  // 3.4 Second plot: volume
  const volumePlot = fmChart.plot(1);
  volumePlot.height("25%");
  volumePlot.background().fill("#050810");
  const volumeSeries = volumePlot.column(fmVolumeMapping);
  volumeSeries.name("Volume");
  volumeSeries.fill("#384058 0.8");
  volumeSeries.stroke(null);
  volumePlot.yAxis().labels().fontColor("#69708b");
  volumePlot.xAxis().labels(false);

  fmVolumeSeries = volumeSeries;

  // 3.5 Scroller with area series
  fmChart.scroller().area(fmCandlesMapping);
  fmChart.scroller().fill("#050810");
  fmChart.scroller().selectedFill("#101627");
  fmChart.scroller().selectedStroke("#26ff88");

  // Pan / zoom interactions are enabled by default.

  // 3.6 Container + draw
  fmChart.container("fm-chart-container");
  fmChart.draw();

  // 3.7 Initialize UI controls
  initFloMatrixControls();
  applySymbolAndVenue();
  applyTimeframe();
});

// -----------------------------
// 4. UI CONTROL WIRING
// -----------------------------

function initFloMatrixControls() {
  const assetClassSelect = document.getElementById("fm-asset-class");
  const symbolSelect = document.getElementById("fm-symbol");
  const venueSelect = document.getElementById("fm-venue");
  const timeframeSelect = document.getElementById("fm-timeframe");
  const priceScaleSelect = document.getElementById("fm-price-scale");

  // fill symbols + venues initially
  refillSymbolAndVenueOptions(assetClassSelect.value);

  assetClassSelect.addEventListener("change", () => {
    const cls = assetClassSelect.value;
    const firstMatch = FM_SYMBOLS.find((s) => s.assetClass === cls);
    if (firstMatch) {
      fmCurrentSymbol = firstMatch;
      refillSymbolAndVenueOptions(cls);
      applySymbolAndVenue();
    }
  });

  symbolSelect.addEventListener("change", () => {
    const id = symbolSelect.value;
    const found = FM_SYMBOLS.find((s) => s.id === id);
    if (found) {
      fmCurrentSymbol = found;
      // same data for now, but we update labels and title
      applySymbolAndVenue();
    }
  });

  venueSelect.addEventListener("change", () => {
    // in prototype, venue is read-only per symbol, but we accept change
    const val = venueSelect.value;
    fmCurrentSymbol = {
      ...fmCurrentSymbol,
      displayVenue: val,
      venue: val,
    };
    applySymbolAndVenue();
  });

  timeframeSelect.addEventListener("change", () => {
    fmCurrentTimeframe = timeframeSelect.value;
    applyTimeframe();
  });

  priceScaleSelect.addEventListener("change", () => {
    applyPriceScale(priceScaleSelect.value);
  });
}

function refillSymbolAndVenueOptions(assetClass) {
  const symbolSelect = document.getElementById("fm-symbol");
  const venueSelect = document.getElementById("fm-venue");

  symbolSelect.innerHTML = "";
  venueSelect.innerHTML = "";

  const filtered = FM_SYMBOLS.filter((s) => s.assetClass === assetClass);

  // If none exist for that asset class yet, fall back to crypto
  const listToUse = filtered.length > 0 ? filtered : FM_SYMBOLS.filter((s) => s.assetClass === "crypto");

  for (const s of listToUse) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    symbolSelect.appendChild(opt);
  }

  // Use first symbol from this class as "current"
  fmCurrentSymbol = listToUse[0];

  const venues = [...new Set(listToUse.map((s) => s.displayVenue))];
  for (const v of venues) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    venueSelect.appendChild(opt);
  }

  venueSelect.value = fmCurrentSymbol.displayVenue;
}

// -----------------------------
// 5. APPLY SETTINGS TO CHART
// -----------------------------

function applySymbolAndVenue() {
  if (!fmChart || !fmPlot) return;

  // Update series name
  const label = `${fmCurrentSymbol.label}`;
  fmCandleSeries.name(label);
  fmVolumeSeries.name(label + " Volume");

  // Update small top text
  const titleEl = document.getElementById("fm-topbar-title");
  const assetPill = document.getElementById("fm-topbar-asset-pill");
  const venuePill = document.getElementById("fm-topbar-venue-pill");

  if (titleEl) {
    titleEl.textContent = `FLOMATRIX · ${fmCurrentSymbol.label} · ${fmCurrentTimeframe} · Prototype`;
  }

  if (assetPill) {
    const span = assetPill.querySelector("span");
    if (span) span.textContent = fmCurrentSymbol.assetClass.toUpperCase();
  }

  if (venuePill) {
    const span = venuePill.querySelector("span");
    if (span) span.textContent = fmCurrentSymbol.displayVenue;
  }
}

/**
 * Timeframe is implemented as:
 * - All candles share same daily prototype data
 * - We simply adjust the visible date range.
 */
function applyTimeframe() {
  if (!fmChart || !fmDataTable) return;

  const raw = FM_PROTOTYPE_DATA;
  if (!raw || raw.length === 0) return;

  const lastRow = raw[raw.length - 1];
  const lastDateStr = lastRow[0];
  const lastDate = new Date(lastDateStr + "T00:00:00Z");

  let fromDate = null;

  switch (fmCurrentTimeframe) {
    case "1D":
      fromDate = new Date(lastDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      break;
    case "5D":
      fromDate = new Date(lastDate.getTime() - 5 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      fromDate = new Date(lastDate);
      fromDate.setMonth(fromDate.getMonth() - 1);
      break;
    case "3M":
      fromDate = new Date(lastDate);
      fromDate.setMonth(fromDate.getMonth() - 3);
      break;
    case "6M":
      fromDate = new Date(lastDate);
      fromDate.setMonth(fromDate.getMonth() - 6);
      break;
    case "1Y":
      fromDate = new Date(lastDate);
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      break;
    case "ALL":
    default:
      fromDate = new Date(raw[0][0] + "T00:00:00Z");
      break;
  }

  fmChart.selectRange(fromDate, lastDate);
  applySymbolAndVenue(); // refresh title with new tf label
}

function applyPriceScale(mode) {
  if (!fmPlot) return;

  switch (mode) {
    case "log":
      fmPlot.yScale().logBase(10);
      fmPlot.yScale().mode("log");
      break;
    case "percent":
      fmPlot.yScale().mode("percent");
      break;
    case "normal":
    default:
      fmPlot.yScale().mode("normal");
      break;
  }
}
