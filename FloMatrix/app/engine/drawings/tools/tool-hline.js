// app/engine/drawings/tools/tool-hline.js
// Horizontal line tool
//
// FM-TOOL-HLINE-001

import { ToolBase } from "./tool-base.js";

export class ToolHLine extends ToolBase {
  onStart(x, y) {
    const obj = {
      type: "hline",
      y,
      color: "#2ef27e",
      width: 1.4,

      draw(ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = ctx.canvas.width / dpr;

        ctx.save();
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.width;

        ctx.beginPath();
        ctx.moveTo(0, obj.y);
        ctx.lineTo(w, obj.y);
        ctx.stroke();

        ctx.restore();
      },
    };

    return obj;
  }

  onMove(x, y, obj) {
    obj.y = y;
  }

  onEnd(x, y, obj) {
    obj.y = y;
  }
}
