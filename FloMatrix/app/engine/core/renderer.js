// app/engine/core/renderer.js
// FloEngine v3.0 — WebGL candle renderer
// Responsible for turning OHLC data into neon institutional candles.
//
// FM-RENDERER-CORE-001

import { createProgramFromSources } from "./shaders.js";

export class FloRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;

    this.aPosition = null;
    this.aColor = null;
    this.uResolution = null;

    this.positionBuffer = null;
    this.colorBuffer = null;

    this.viewportWidth = 0;
    this.viewportHeight = 0;

    this._initProgram();
    this._initBuffers();
  }

  _initProgram() {
    const gl = this.gl;

    this.program = createProgramFromSources(gl);
    if (!this.program) {
      console.error("[FloRenderer] Failed to create shader program");
      return;
    }

    gl.useProgram(this.program);

    // Attributes
    this.aPosition = gl.getAttribLocation(this.program, "a_position");
    this.aColor = gl.getAttribLocation(this.program, "a_color");

    // Uniforms
    this.uResolution = gl.getUniformLocation(this.program, "u_resolution");

    if (this.aPosition < 0 || this.aColor < 0 || !this.uResolution) {
      console.error("[FloRenderer] Failed to get attribute/uniform locations");
    }
  }

  _initBuffers() {
    const gl = this.gl;

    this.positionBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
  }

  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Render visible OHLC data.
   * @param {Array<{t:number,o:number,h:number,l:number,c:number,v:number}>} data
   * @param {Object} state
   */
  render(data, state) {
    const gl = this.gl;
    if (!this.program || !data || data.length === 0) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.useProgram(this.program);
    gl.viewport(0, 0, this.viewportWidth, this.viewportHeight);

    // Clear background (subtle dark)
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Compute min/max for visible data
    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      if (!bar) continue;
      if (bar.l < minPrice) minPrice = bar.l;
      if (bar.h > maxPrice) maxPrice = bar.h;
    }

    if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice === maxPrice) {
      minPrice = 0.0;
      maxPrice = 1.0;
    }

    const priceRange = maxPrice - minPrice || 1.0;

    // Build geometry
    const { positions, colors } = this._buildCandleGeometry(
      data,
      minPrice,
      maxPrice,
      priceRange,
      state
    );

    // Upload position data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STREAM_DRAW);

    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    // Upload color data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STREAM_DRAW);

    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.uniform2f(this.uResolution, this.viewportWidth, this.viewportHeight);

    const vertexCount = positions.length / 2;
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  /**
   * Build candle body geometry (two triangles per candle).
   * We can expand later with wicks, shadows, profiles, etc.
   */
  _buildCandleGeometry(data, minPrice, maxPrice, priceRange, state) {
    const width = this.viewportWidth;
    const height = this.viewportHeight;

    const barCount = data.length;
    if (barCount === 0) {
      return {
        positions: new Float32Array(0),
        colors: new Float32Array(0),
      };
    }

    // visual layout
    const paddingLeft = 10;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 10;

    const chartWidth = Math.max(1, width - paddingLeft - paddingRight);
    const chartHeight = Math.max(1, height - paddingTop - paddingBottom);

    const barPixelWidth = chartWidth / Math.max(1, barCount);
    const bodyWidth = barPixelWidth * 0.6; // thickness of the candle body

    // Colors — neon institutional
    const bullColor = [0.18, 0.95, 0.49, 1.0]; // #2ef27e-ish
    const bearColor = [1.0, 0.30, 0.42, 1.0]; // #ff4d6b-ish
    const neutralColor = [0.78, 0.90, 1.0, 1.0];

    // Geometry arrays (6 vertices per candle body, 2 triangles)
    const maxVertices = barCount * 6;

    const positions = new Float32Array(maxVertices * 2); // x,y
    const colors = new Float32Array(maxVertices * 4); // r,g,b,a

    let vertIndex = 0;
    let colorIndex = 0;

    for (let i = 0; i < barCount; i++) {
      const bar = data[i];
      if (!bar) continue;

      const isBull = bar.c > bar.o;
      const isBear = bar.c < bar.o;

      const cX = paddingLeft + (i + 0.5) * barPixelWidth;
      const halfBody = bodyWidth * 0.5;

      const x0 = cX - halfBody;
      const x1 = cX + halfBody;

      const yOpen = this._priceToY(
        bar.o,
        minPrice,
        priceRange,
        chartHeight,
        paddingTop,
        paddingBottom,
        height
      );
      const yClose = this._priceToY(
        bar.c,
        minPrice,
        priceRange,
        chartHeight,
        paddingTop,
        paddingBottom,
        height
      );

      const yTop = Math.min(yOpen, yClose);
      const yBottom = Math.max(yOpen, yClose);

      const color = isBull ? bullColor : isBear ? bearColor : neutralColor;

      // Two triangles for rectangle:
      // (x0, yTop) → (x1, yTop) → (x0, yBottom)
      // (x0, yBottom) → (x1, yTop) → (x1, yBottom)

      const coords = [
        x0, yTop,
        x1, yTop,
        x0, yBottom,

        x0, yBottom,
        x1, yTop,
        x1, yBottom,
      ];

      for (let v = 0; v < coords.length; v += 2) {
        positions[vertIndex++] = coords[v];
        positions[vertIndex++] = coords[v + 1];

        colors[colorIndex++] = color[0];
        colors[colorIndex++] = color[1];
        colors[colorIndex++] = color[2];
        colors[colorIndex++] = color[3];
      }

      // (Later we can append wick geometry here: thin rect from low to high)
    }

    // If we didn't fill the full arrays, slice them down
    const finalPositions = positions.subarray(0, vertIndex);
    const finalColors = colors.subarray(0, colorIndex);

    return {
      positions: finalPositions,
      colors: finalColors,
    };
  }

  _priceToY(
    price,
    minPrice,
    priceRange,
    chartHeight,
    paddingTop,
    paddingBottom,
    totalHeight
  ) {
    const normalized = (price - minPrice) / priceRange; // 0..1
    const yChart = chartHeight * (1.0 - normalized);    // invert (higher price = lower y in pixels)
    const y = paddingTop + yChart;

    // clamp for safety
    const minY = paddingTop;
    const maxY = totalHeight - paddingBottom;
    return Math.min(Math.max(y, minY), maxY);
  }
}
