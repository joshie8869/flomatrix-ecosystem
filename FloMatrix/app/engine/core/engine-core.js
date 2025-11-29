// app/engine/core/engine-core.js
// FloEngine v3.0 — Institutional Chart Core
// Handles chart initialization, canvas setup, resize system,
// coordinate transforms, pan/zoom windowing, and render loop.
//
// FM-ENGINE-CORE-001

import { createGLContext } from "./gl-context.js";
import { FloRenderer } from "./renderer.js";
import { SAMPLE_OHLC } from "./sample-ohlc.js";

export function initFloEngine(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("[FloEngine] Canvas not found:", canvasId);
    return null;
  }

  // -------------------------
  // STATE
  // -------------------------
  const state = {
    data: SAMPLE_OHLC,       // OHLC array [{t, o, h, l, c, v}]
    rangeBars: 200,          // Number of bars visible
    offset: 0,               // Pan offset (bars from right)
    timeframe: "5m",         // default
    symbol: "BTCUSD",
    assetClass: "crypto",
    venue: "BINANCE",
    lastResize: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  };

  // -------------------------
  // GL CONTEXT
  // -------------------------
  const gl = createGLContext(canvas);
  if (!gl) {
    console.error("[FloEngine] WebGL initialization failed");
    return null;
  }

  const renderer = new FloRenderer(gl);

  // -------------------------
  // RENDER LOOP (define FIRST to avoid TDZ)
  // -------------------------
  let renderQueued = false;

  function getVisibleData() {
    const { data, rangeBars, offset } = state;

    const startIndex = Math.max(0, data.length - rangeBars - offset);
    const endIndex = Math.max(startIndex + 1, data.length - offset);

    return data.slice(startIndex, endIndex);
  }

  function requestRender() {
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(render);
    }
  }

  function render() {
    renderQueued = false;

    const visible = getVisibleData();
    renderer.render(visible, state);
  }

  // -------------------------
  // SIZING & RESIZING
  // -------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    gl.viewport(0, 0, canvas.width, canvas.height);
    renderer.setViewport(canvas.width, canvas.height);

    state.viewportWidth = canvas.width;
    state.viewportHeight = canvas.height;
    state.lastResize = performance.now();

    requestRender();
  }

  window.addEventListener("resize", resize);

  // -------------------------
  // COORDINATE TRANSFORMS
  // -------------------------
  function screenToDataX(px) {
    const bars = state.rangeBars;
    return (px / canvas.width) * bars;
  }

  // -------------------------
  // PAN / ZOOM
  // -------------------------
  let isPanning = false;
  let panStartX = 0;
  let panStartOffset = 0;

  canvas.addEventListener("mousedown", (e) => {
    isPanning = true;
    panStartX = e.clientX;
    panStartOffset = state.offset;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;

    const dx = e.clientX - panStartX;
    const barsMoved = screenToDataX(-dx);

    state.offset = Math.max(0, panStartOffset + Math.floor(barsMoved));
    requestRender();
  });

  const stopPanning = () => {
    isPanning = false;
  };

  canvas.addEventListener("mouseup", stopPanning);
  canvas.addEventListener("mouseleave", stopPanning);
  window.addEventListener("mouseup", stopPanning);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      const delta = Math.sign(e.deltaY);
      const newRange = state.rangeBars + delta * 10;

      state.rangeBars = Math.min(Math.max(20, newRange), 2000);
      requestRender();
    },
    { passive: false }
  );

  // Initial sizing + first render
  resize();

  // -------------------------
  // PUBLIC API
  // -------------------------
  return {
    setSymbol({ symbol, assetClass, venue }) {
      state.symbol = symbol;
      state.assetClass = assetClass;
      state.venue = venue;
      requestRender();
    },

    setTimeframe(tf) {
      state.timeframe = tf;
      requestRender();
    },

    setData(newData) {
      state.data = newData;
      requestRender();
    },

    update() {
      requestRender();
    },

    getState() {
      return state;
    },
  };
}
