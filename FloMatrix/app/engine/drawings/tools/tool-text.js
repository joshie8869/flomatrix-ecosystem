// app/engine/drawings/tools/tool-text.js
// Text label tool (will become fully editable soon)
//
// FM-TOOL-TEXT-001

import { ToolBase } from "./tool-base.js";

export class ToolText extends ToolBase {
  onStart(x, y) {
    const obj = {
      type: "text",
      x,
      y,
      text: "Note",
      color: "#e7f2ff",
      font: "13px system-ui",
      bg: "rgba(0,0,0,0.55)",
      padding: 5,

      draw(ctx) {
        ctx.save();

        ctx.font = obj.font;
        ctx.textBaseline = "top";

        const metrics = ctx.measureText(obj.text);
        const textWidth = metrics.width;
        const textHeight = 16; // approximate for 13px font

        const boxX = obj.x - obj.padding;
        const boxY = obj.y - obj.padding;
        const boxW = textWidth + obj.padding * 2;
        const boxH = textHeight + obj.padding * 2;

        // Background box
        ctx.fillStyle = obj.bg;
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Text
        ctx.fillStyle = obj.color;
        ctx.fillText(obj.text, obj.x, obj.y);

        ctx.restore();
      },
    };

    return obj;
  }

  onMove(x, y, obj) {
    obj.x = x;
    obj.y = y;
  }

  onEnd(x, y, obj) {
    obj.x = x;
    obj.y = y;
  }
}
