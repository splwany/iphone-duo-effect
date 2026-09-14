import { defaultParameters } from "../parameters";
import { vertex, fragment } from "./shaders";

// Depth-dependent focus on one flat screen. No physical phone mesh is rendered.
export class DepthRenderer {
  parameters = { ...defaultParameters };
  private events = new AbortController();
  private lost = false;
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  amount: number;
  image: HTMLCanvasElement | null;
  program?: WebGLProgram;
  texture: WebGLTexture | null = null;
  buffer: WebGLBuffer | null = null;
  locations: Record<string, WebGLUniformLocation | null> = {};
  private shaders: WebGLShader[] = [];
  constructor(host: HTMLElement) {
    this.host = host;
    this.amount = 0;
    this.image = null;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%";
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    this.canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        this.lost = true;
        this.canvas.style.display = "none";
      },
      { signal: this.events.signal },
    );
    this.canvas.addEventListener(
      "webglcontextrestored",
      () => {
        this.lost = false;
        this.initialize();
        if (this.image) this.setImage(this.image);
        this.canvas.style.display = "";
      },
      { signal: this.events.signal },
    );
    this.initialize();
  }
  private initialize() {
    if (!this.gl) return;
    const gl = this.gl;
    this.shaders = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      this.shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
      return shader;
    };
    try {
      const program = gl.createProgram()!;
      this.program = program;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error("Shader link failed");
      this.program = program;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      this.buffer = buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const pos = gl.getAttribLocation(program, "pos");
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.locations = {};
      for (const key of [
        "blurCurve",
        "scatterFocus",
        "scatterX",
        "scatterY",
        "grazingRange",
        "edgeSoftness",
        "blurBlend",
        "tilt",
        "blurStrength",
        "horizontalStretch",
        "farShrink",
        "viewSize",
        "imageSize",
      ])
        this.locations[key] = gl.getUniformLocation(program, key);
      this.host.appendChild(this.canvas);
    } catch (error) {
      console.error(error);
      this.gl = null;
    }
  }
  setImage(image: HTMLCanvasElement) {
    this.image = image;
    if (!this.gl || this.lost) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.SRGB8_ALPHA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    this.draw(this.amount);
  }
  draw(amount: number) {
    this.amount = amount;
    if (!this.gl || this.lost || !this.image) return;
    const gl = this.gl,
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(this.host.clientWidth * ratio)),
      height = Math.max(1, Math.round(this.host.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform1f(this.locations.blurCurve, this.parameters.blurCurve);
    gl.uniform1f(this.locations.scatterFocus, this.parameters.scatterFocus);
    gl.uniform1f(this.locations.scatterX, this.parameters.scatterX);
    gl.uniform1f(this.locations.scatterY, this.parameters.scatterY);
    gl.uniform1f(this.locations.grazingRange, this.parameters.grazingRange);
    gl.uniform1f(this.locations.edgeSoftness, this.parameters.edgeSoftness);
    gl.uniform1f(this.locations.blurBlend, this.parameters.blurBlend);
    gl.uniform1f(
      this.locations.horizontalStretch,
      this.parameters.horizontalStretch,
    );
    gl.uniform1f(this.locations.farShrink, this.parameters.farShrink);
    gl.uniform1f(this.locations.blurStrength, this.parameters.blurStrength);
    gl.uniform1f(this.locations.tilt, amount);
    gl.uniform2f(
      this.locations.viewSize,
      this.host.clientWidth,
      this.host.clientHeight,
    );
    gl.uniform2f(this.locations.imageSize, this.image.width, this.image.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  dispose() {
    this.events.abort();
    const gl = this.canvas.getContext("webgl2");
    if (gl) {
      gl.deleteTexture(this.texture);
      gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
      this.shaders.forEach((shader) => gl.deleteShader(shader));
    }
    this.canvas.remove();
  }
}
