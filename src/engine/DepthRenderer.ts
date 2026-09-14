// Depth-dependent focus on one flat screen. No physical phone mesh is rendered.
export class DepthRenderer {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  blurStrength: number;
  horizontalStretch: number;
  farShrink: number;
  amount: number;
  image: HTMLImageElement | HTMLCanvasElement | null;
  blurCurve: number;
  scatterFocus: number;
  scatterX: number;
  scatterY: number;
  grazingRange: number;
  edgeSoftness: number;
  blurBlend: number;
  followSmooth: number;
  program?: WebGLProgram;
  texture: WebGLTexture | null = null;
  buffer: WebGLBuffer | null = null;
  locations: Record<string, WebGLUniformLocation | null> = {};
  private shaders: WebGLShader[] = [];
  constructor(host: HTMLElement) {
    this.host = host;
    this.blurStrength = 0.1;
    this.horizontalStretch = 0.9;
    this.farShrink = 0.13;
    this.amount = 0;
    this.image = null;
    this.blurCurve = 2;
    this.scatterFocus = 2;
    this.scatterX = 2;
    this.scatterY = 1;
    this.grazingRange = 0.5;
    this.edgeSoftness = 1;
    this.blurBlend = 0.7;
    this.followSmooth = 35;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%";
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!this.gl) return;
    const gl = this.gl;
    const vertex = `#version 300 es
    in vec2 pos; out vec2 uv; void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0.,1.);}`;
    const fragment = `#version 300 es
    precision highp float;
    uniform sampler2D photo; uniform float tilt; uniform float blurStrength; uniform float horizontalStretch; uniform float farShrink; uniform vec2 viewSize; uniform vec2 imageSize;
    uniform float blurCurve;uniform float scatterFocus;uniform float scatterX;uniform float scatterY;uniform float grazingRange;uniform float edgeSoftness;uniform float blurBlend;
    in vec2 uv; out vec4 color;
    // The sRGB texture decodes before filtering. Encode only after light mixing.
    vec3 toDisplay(vec3 light){
      light=max(light,vec3(0.));
      return mix(1.055*pow(light,vec3(1./2.4))-.055,
        12.92*light,lessThanEqual(light,vec3(.0031308)));
    }
    vec3 samplePhoto(vec2 p,float lod){
      vec2 fit=vec2(1.);float a=viewSize.x/viewSize.y;float b=imageSize.x/imageSize.y;
      if(a>b)fit.y=b/a;else fit.x=a/b;
      vec2 tex=(clamp(p,vec2(0.),vec2(1.))-.5)*fit+.5;
      // Filter the silhouette with the same footprint as each color sample.
      // The disk then blurs content and coverage together; a fixed hard mask
      // per tap would reproduce the old stepped edge contours.
      vec2 feather=max(vec2(.75)/viewSize,edgeSoftness*exp2(lod)/(imageSize*fit));
      vec2 coverage=smoothstep(-feather,feather,p)
        *(1.-smoothstep(vec2(1.)-feather,vec2(1.)+feather,p));
      return textureLod(photo,tex,lod).rgb*coverage.x*coverage.y;
    }
    void main(){
      float strength=clamp(abs(tilt),0.,1.);
      // The far edge swaps when the phone tips in the other direction.
      float across=tilt<0.?uv.x:1.-uv.x;
      float angle=strength*1.57079632679;
      float depth=across*sin(angle);
      // Independent artistic controls: horizontal sampling compression
      // stretches the page; vertical sampling expansion contracts the far edge.
      float projected=across*mix(1.,cos(angle),horizontalStretch);
      float verticalScale=1.-.65*farShrink*depth;
      float projectedY=.5+(uv.y-.5)/verticalScale;
      vec2 p=vec2(tilt<0.?projected:1.-projected,projectedY);
      // A thin scattering cover lifted from the page: z = x*sin(theta).
      // A scattering cone of half-angle alpha produces radius z*tan(alpha).
      // Use CSS-pixel distances so the effect scales with the displayed page,
      // not with uploaded image resolution or device pixel ratio.
      float distanceFromPage=depth*viewSize.x;
      float scatterAngle=blurStrength*.5235987756; // 0 to 30 degrees
      // Artistic quadratic distance response: slow near contact, stronger far away.
      // Retains the geometric distance, but is not a literal material law.
      float radius=viewSize.x*tan(scatterAngle)*pow(depth,blurCurve);
      // Local oblique ray/plane footprint: angular deviations scale as
      // sec(theta)^2 in the tilt plane and sec(theta) across it.
      // This is a small-cone visual approximation, not a measured acrylic BTDF.
      // Regularize grazing incidence continuously: max axes are 4x and 2x.
      float sinAngle=sin(angle);
      float cosEffective=sqrt(cos(angle)*cos(angle)+pow(1.-grazingRange,2.)*sinAngle*sinAngle);
      vec2 footprint=vec2(pow(cosEffective,-scatterX),pow(cosEffective,-scatterY));
      vec2 radii=radius*footprint;
      float baseLod=max(0.,log2(max(imageSize.x/viewSize.x,imageSize.y/viewSize.y)));
      // Use the minor axis for mip filtering; the explicit taps resolve the
      // longer axis without turning the ellipse back into an isotropic blur.
      float lod=max(baseLod,log2(max(1.,min(radii.x,radii.y)*imageSize.y/viewSize.y*blurBlend)));
      vec2 stepSize=radii/viewSize;
      // Truncated Gaussian disk: paired offsets avoid directional bias.
      // Normalize weights so scattering does not dim a uniform page.
      vec3 sum=vec3(0.);
      float weightSum=0.;
      for(int i=0;i<12;i++){
        float t=(float(i)+.5)*2.39996323;
        float r=sqrt((float(i)+.5)/12.);
        float weight=exp(-scatterFocus*r*r);
        vec2 offset=vec2(cos(t),sin(t))*r*stepSize;
        sum+=(samplePhoto(p+offset,lod)+samplePhoto(p-offset,lod))*weight;
        weightSum+=2.*weight;
      }
      color=vec4(toDisplay(sum/weightSum),1.);
    }`;
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
      host.appendChild(this.canvas);
      this.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.canvas.style.display = "none";
      });
      this.canvas.addEventListener("webglcontextrestored", () =>
        location.reload(),
      );
    } catch (error) {
      console.error(error);
      this.gl = null;
    }
  }
  setImage(image: HTMLImageElement | HTMLCanvasElement) {
    this.image = image;
    if (!this.gl) return;
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
    if (!this.gl || !this.image) return;
    const gl = this.gl,
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(this.host.clientWidth * ratio)),
      height = Math.max(1, Math.round(this.host.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform1f(this.locations.blurCurve, this.blurCurve);
    gl.uniform1f(this.locations.scatterFocus, this.scatterFocus);
    gl.uniform1f(this.locations.scatterX, this.scatterX);
    gl.uniform1f(this.locations.scatterY, this.scatterY);
    gl.uniform1f(this.locations.grazingRange, this.grazingRange);
    gl.uniform1f(this.locations.edgeSoftness, this.edgeSoftness);
    gl.uniform1f(this.locations.blurBlend, this.blurBlend);
    gl.uniform1f(this.locations.horizontalStretch, this.horizontalStretch);
    gl.uniform1f(this.locations.farShrink, this.farShrink);
    gl.uniform1f(this.locations.blurStrength, this.blurStrength);
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
