// app/main.js
// FloMatrix front-end shell + FloEngine WebGL init + R:R overlay

import { initFloEngine } from "./engine/core/engine-core.js";
import { SAMPLE_OHLC } from "./engine/core/sample-ohlc.js";

let currentTool = "cursor";

// simple in-memory RR objects
const rrBoxes = [];
let activeRR = null;

function setupToolbar() {
  const buttons = document.querySelectorAll(".fm-tool-button");
  const textDrawer = document.getElementById("fm-text-drawer");

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tool = btn.getAttribute("data-tool");

      // reset active state
      buttons.forEach(b => b.classList.remove("active"));

      if (tool === "text") {
        const visible = textDrawer.classList.toggle("visible");
        currentTool = visible ? "text" : "cursor";
        if (visible) btn.classList.add("active");
      } else {
        textDrawer.classList.remove("visible");
        currentTool = tool;
        btn.classList.add("active");
      }

      console.log("[FloMatrix] Tool selected:", currentTool);
      updateOverlayPointerEvents();
    });
  });

  // clicking outside toolbar closes drawer & resets text tool
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".fm-left-toolbar")) {
      textDrawer.classList.remove("visible");
      if (currentTool === "text") currentTool = "cursor";
      buttons.forEach(b => b.classList.remove("active"));
      updateOverlayPointerEvents();
    }
  });
}

function setupPriceRailFromSample() {
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
      maximumFractionDigits: 2
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
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
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
      yStop: y + 60,      // initial guess
      direction: "long"   // future: infer from drag
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
  const clearButton = document.querySelector('.fm-tool-button[data-tool="clear"]');
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

  all.forEach(rr => drawSingleRR(ctx, rr));
}

function drawSingleRR(ctx, rr) {
  const {
    xStart, xEnd,
    yEntry, yStop,
    direction
  } = rr;

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
  roundedRect(ctx, xLeft, targetTop, xRight - xLeft, targetBottom - targetTop, 4);
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
  initFloEngine("flo-chart-canvas");

  // 2) Wire up left toolbar + text drawer
  setupToolbar();

  // 3) Price rail from sample data
  setupPriceRailFromSample();

  // 4) R:R overlay on top canvas
  initRROverlay();
  updateOverlayPointerEvents();
}

document.addEventListener("DOMContentLoaded", bootstrap);
