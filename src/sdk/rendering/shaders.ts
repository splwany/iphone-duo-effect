export const vertex = `#version 300 es
    in vec2 pos; out vec2 uv; void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0.,1.);}`;
export const fragment = `#version 300 es
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
      // Keep the clear, untilted image intact. The upper half adds visible
      // feathering as the page tilts; 50% (scale 1) preserves the baseline.
      float edgeScale=edgeSoftness<=1.?edgeSoftness:1.+(edgeSoftness-1.)*sin(abs(tilt)*1.57079632679);
      vec2 feather=max(vec2(.75)/viewSize,edgeScale*exp2(lod)/(imageSize*fit));
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
