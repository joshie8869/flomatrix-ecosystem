// app/engine/drawings/tools/tool-rect.js
// Zone / region box tool
//
// FM-TOOL-RECT-001

import { ToolBase } from "./tool-base.js";

export class ToolRect extends ToolBase {
  onStart(x, y) {
    const obj = {
      type: "rect",
      x1: x,
      y1: y,
      x2: x,
      y2: y,

      border: "#2ef27e",
      fill: "rgba(46,242,126,0.10)",
      width: 1.2,

      draw(ctx) {
        const dpr = window.devicePixelRatio || 1;

        // Normalize width/height so drawing always goes top-left → bottom-right
        const x = Math.min(obj.x1, obj.x2);
        const y = Math.min(obj.y1, obj.y2);

        const w = Math.abs(obj.x2 - obj.x1);
        const h = Math.abs(obj.y2 - obj.y1);

        const renderW = w;
        const renderH = h;

        ctx.save();

        ctx.fillStyle = obj.fill;
        ctx.strokeStyle = obj.border;
        ctx.lineWidth = obj.width;

        ctx.beginPath();
        ctx.rect(x, y, renderW, renderH);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    };

    return obj;
  }

  onMove(x, y, obj) {
    obj.x2 = x;
    obj.y2 = y;
  }

  onEnd(x, y, obj) {
    obj.x2 = x;
    obj.y2 = y;
  }
}
