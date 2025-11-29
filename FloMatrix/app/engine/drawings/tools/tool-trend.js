// app/engine/drawings/tools/tool-trend.js
// Trend line & ray drawing tool
//
// FM-TOOL-TREND-001

import { ToolBase } from "./tool-base.js";

export class ToolTrend extends ToolBase {
  onStart(x, y) {
    const obj = {
      type: "trend",
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      color: "#2ef27e",
      width: 1.6,

      draw(ctx) {
        ctx.save();
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.width;

        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
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
