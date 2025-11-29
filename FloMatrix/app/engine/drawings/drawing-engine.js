// app/engine/drawings/drawing-engine.js
// FloEngine v3.1 — Institutional Drawing Engine
// Handles routing tool events to drawing tools, canvas rendering,
// selection, hit-testing, and persistent drawing storage.
//
// FM-DRAWING-ENGINE-001

import { ToolTrend } from "./tools/tool-trend.js";
import { ToolHLine } from "./tools/tool-hline.js";
import { ToolRect } from "./tools/tool-rect.js";
import { ToolText } from "./tools/tool-text.js";
import { ToolRR } from "./tools/tool-rr.js";

export class DrawingEngine {
  constructor(overlayCanvas, engine, scaleEngine) {
    this.canvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext("2d");

    this.engine = engine;
    this.scaleEngine = scaleEngine;

    this.drawings = [];
    this.activeTool = null;

    this.currentToolId = null;
    this.tempDrawing = null;

    this.isDown = false;
    this.downX = 0;
    this.downY = 0;

    this._bindEvents();
    this._resize();
  }

  _bindEvents() {
    window.addEventListener("resize", () => this._resize());

    this.canvas.addEventListener("mousedown", (e) => this._onDown(e));
    this.canvas.addEventListener("mousemove", (e) => this._onMove(e));
    this.canvas.addEventListener("mouseup", (e) => this._onUp(e));
    this.canvas.addEventListener("mouseleave", (e) => this._onUp(e));
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set backing store to device pixels
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Ensure CSS size matches layout
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";

    // Reset transform before applying new scale to avoid compounding
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.render();
  }

  // -----------------------------
  // TOOL MANAGEMENT
  // -----------------------------
  setTool(toolId) {
    this.currentToolId = toolId;

    switch (toolId) {
      case "trend":
        this.activeTool = new ToolTrend(this.engine, this.scaleEngine);
        break;
      case "hline":
        this.activeTool = new ToolHLine(this.engine, this.scaleEngine);
        break;
      case "box":
        this.activeTool = new ToolRect(this.engine, this.scaleEngine);
        break;
      case "text":
        this.activeTool = new ToolText(this.engine, this.scaleEngine);
        break;
      case "rr":
        this.activeTool = new ToolRR(this.engine, this.scaleEngine);
        break;
      default:
        this.activeTool = null;
    }
  }

  clearAll() {
    this.drawings = [];
    this.tempDrawing = null;
    this.render();
  }

  // -----------------------------
  // MOUSE EVENTS
  // -----------------------------
  _onDown(e) {
    if (!this.activeTool) return;

    this.isDown = true;

    const rect = this.canvas.getBoundingClientRect();
    this.downX = e.clientX - rect.left;
    this.downY = e.clientY - rect.top;

    this.tempDrawing = this.activeTool.onStart(this.downX, this.downY);
  }

  _onMove(e) {
    if (!this.activeTool || !this.isDown) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.activeTool.onMove(x, y, this.tempDrawing);
    this.render();
  }

  _onUp(e) {
    if (!this.isDown || !this.activeTool) {
      this.isDown = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const upX = e.clientX - rect.left;
    const upY = e.clientY - rect.top;

    this.activeTool.onEnd(upX, upY, this.tempDrawing);

    this.drawings.push(this.tempDrawing);
    this.tempDrawing = null;

    this.isDown = false;
    this.render();
  }

  // -----------------------------
  // RENDER LOOP
  // -----------------------------
  render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    for (const d of this.drawings) {
      d.draw(ctx);
    }

    if (this.tempDrawing) {
      this.tempDrawing.draw(ctx);
    }
  }
}
