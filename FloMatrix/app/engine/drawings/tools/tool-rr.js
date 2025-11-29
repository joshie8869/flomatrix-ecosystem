// app/engine/drawings/tools/tool-rr.js
// Risk/Reward position tool — institutional-grade
//
// FM-TOOL-RR-001

import { ToolBase } from "./tool-base.js";

export class ToolRR extends ToolBase {
  onStart(x, y) {
    const entry = y;

    const obj = {
      type: "rr",

      entryY: entry,
      stopY: entry + 40,
      targetY: entry - 80,

      colorRisk: "rgba(255,77,107,0.18)",
      borderRisk: "rgba(255,77,107,0.9)",

      colorReward: "rgba(46,242,126,0.14)",
      borderReward: "rgba(46,242,126,0.9)",

      labelBg: "rgba(0,0,0,0.85)",
      labelFg: "#e7f2ff",

      draw(ctx) {
        const dpr = window.devicePixelRatio || 1;
        const fullWidth = ctx.canvas.width / dpr;

        const entry = obj.entryY;
        const stop = obj.stopY;
        const target = obj.targetY;

        const xLeft = 20;
        const xRight = fullWidth - 20;
        const boxW = xRight - xLeft;

        ctx.save();

        // --------------------------------------
        // Risk box
        // --------------------------------------
        const rTop = Math.min(entry, stop);
        const rBot = Math.max(entry, stop);

        ctx.fillStyle = obj.colorRisk;
        ctx.strokeStyle = obj.borderRisk;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.rect(xLeft, rTop, boxW, rBot - rTop);
        ctx.fill();
        ctx.stroke();

        // --------------------------------------
        // Reward box
        // --------------------------------------
        const rewardTop = target;
        const rewardBot = entry;

        ctx.fillStyle = obj.colorReward;
        ctx.strokeStyle = obj.borderReward;

        ctx.beginPath();
        ctx.rect(xLeft, rewardTop, boxW, rewardBot - rewardTop);
        ctx.fill();
        ctx.stroke();

        // --------------------------------------
        // Entry line
        // --------------------------------------
        ctx.strokeStyle = "#ffffff88";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(10, entry);
        ctx.lineTo(fullWidth - 10, entry);
        ctx.stroke();

        ctx.setLineDash([]);

        // --------------------------------------
        // Label (R:R text box)
        // --------------------------------------
        const riskPx = Math.abs(stop - entry);
        const rewardPx = Math.abs(entry - target);
        const rr = (rewardPx / riskPx).toFixed(2);

        const labelText = `R:R 1 : ${rr}`;

        ctx.font = "12px system-ui";
        const textW = ctx.measureText(labelText).width;

        const labelW = textW + 12;
        const labelH = 16;

        // place label above reward zone
        const bx = xLeft + (boxW - labelW) / 2;
        const by = rewardTop - labelH - 4;

        ctx.fillStyle = obj.labelBg;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";

        ctx.beginPath();
        ctx.rect(bx, by, labelW, labelH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = obj.labelFg;
        ctx.fillText(labelText, bx + 6, by + 3);

        ctx.restore();
      }
    };

    return obj;
  }

  onMove(x, y, obj) {
    obj.stopY = y;

    const risk = Math.abs(obj.stopY - obj.entryY);
    obj.targetY = obj.entryY - risk * 2; // default 1:2 risk:reward
  }

  onEnd(x, y, obj) {
    obj.stopY = y;

    const risk = Math.abs(obj.stopY - obj.entryY);
    obj.targetY = obj.entryY - risk * 2;
  }
}
