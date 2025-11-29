// app/engine/interactions/interaction-engine.js
// FloEngine v3.0 — Institutional Interaction Engine
// Handles all chart-level mouse interactions: pan, zoom,
// drag, wheel mapping, and event routing.
//
// FM-INTERACTIONS-001

export class InteractionEngine {
  constructor(canvas, state, scaleEngine, requestRender) {
    this.canvas = canvas;
    this.state = state;
    this.scaleEngine = scaleEngine;
    this.requestRender = requestRender;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartOffset = 0;

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener("mousedown", (e) => this._onDown(e));
    this.canvas.addEventListener("mousemove", (e) => this._onMove(e));
    this.canvas.addEventListener("mouseup", () => this._onUp());
    this.canvas.addEventListener("mouseleave", () => this._onUp());
    this.canvas.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
  }

  _onDown(e) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartOffset = this.state.offset;
  }

  _onMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;

    const barWidth = this.scaleEngine.computeBarWidth(
      this.canvas.width,
      this.state.rangeBars
    );

    const barsMoved = dx / barWidth;

    this.state.offset = Math.max(0, this.dragStartOffset - Math.floor(barsMoved));
    this.requestRender();
  }

  _onUp() {
    this.isDragging = false;
  }

  _onWheel(e) {
    e.preventDefault();

    const delta = Math.sign(e.deltaY);
    const amount = delta * 8;

    let nr = this.state.rangeBars + amount;
    nr = Math.max(20, Math.min(2000, nr));

    this.state.rangeBars = nr;
    this.requestRender();
  }
}
