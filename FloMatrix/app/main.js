// app/main.js
// Entry point for FloEngine v1.0 (Batch 1 - WebGL core + dummy candles)

import { initFloEngine } from "./engine/core/engine-core.js";

window.addEventListener("load", () => {
  const canvasId = "flo-gl-canvas";
  initFloEngine(canvasId);
  console.log("FloEngine v1.0 — Batch 1 initialized.");
});
