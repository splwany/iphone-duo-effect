# 完整源码阅读版

基线：全参数精调 23。实际编辑以仓库文件为准，此文档为交接快照。

## web/app.js

```javascript
const $ = id => document.getElementById(id);
const fold = $('fold');
const surfaces = [...document.querySelectorAll('.surface')];
let target = 0, current = 0, enabled = false, lastSignal = 0, exitTimer, previousTime = 0, activeURL = null, imageRatio = 393 / 852;
const tracker = new TiltTracker();
const rangeDegrees = 90;
let measuredAngle = 0;
const clamp = n => Math.max(-1, Math.min(1, n));
const renderer = new DepthRenderer(fold);
let blurPercent = 50;
// New range is old 0–20%; old 10% becomes the new midpoint.
try {
  const saved = localStorage.getItem('fold-blur-strength-v2');
  const legacy = localStorage.getItem('fold-blur-strength');
  if(saved !== null && Number.isFinite(Number(saved))) blurPercent = Number(saved);
  else if(legacy !== null && Number.isFinite(Number(legacy))) blurPercent = Number(legacy)*5;
  blurPercent = Math.max(0,Math.min(100,blurPercent));
} catch {}
function applyBlurStrength(value) {
  blurPercent = Number(value); renderer.blurStrength = blurPercent / 500;
  $('blur-strength').value = blurPercent; $('blur-value').textContent = `${blurPercent}%`;
  renderer.draw(current);
}
applyBlurStrength(blurPercent);
$('blur-strength').addEventListener('input', e => {
  applyBlurStrength(e.target.value);
  try { localStorage.setItem('fold-blur-strength-v2',String(blurPercent)); } catch {}
});
const effectResets=[];
function bindShapeControl(id, outputId, property, storageKey, legacyKey, minimum, maximum) {
  let value=50;
  try {
    const saved=localStorage.getItem(storageKey);
    const legacy=legacyKey ? localStorage.getItem(legacyKey) : null;
    if(saved!==null && Number.isFinite(Number(saved))) value=Number(saved);
    else if(legacy!==null && Number.isFinite(Number(legacy))) value=(Number(legacy)/100-minimum)/(maximum-minimum)*100;
  } catch {}
  value=Math.max(0,Math.min(100,value));
  function apply(value) {
    value=Math.round(Number(value));
    renderer[property]=minimum+(maximum-minimum)*value/100;
    $(id).value=value; $(outputId).textContent=`${value}%`;
    renderer.draw(current);
  }
  effectResets.push(() => {
    apply(50);
    try { localStorage.setItem(storageKey,'50'); } catch {}
  });
  apply(value);
  $(id).addEventListener('input', e => {
    apply(e.target.value);
    try { localStorage.setItem(storageKey,e.target.value); } catch {}
  });
}
bindShapeControl('horizontal-stretch','stretch-value','horizontalStretch','fold-horizontal-stretch-v2','fold-horizontal-stretch',.8,1.);
bindShapeControl('far-shrink','shrink-value','farShrink','fold-far-shrink-v2','fold-far-shrink',0,.26);
bindShapeControl('blur-curve','blur-curve-value','blurCurve','fold-blur-curve-v1',null,1,3);
bindShapeControl('scatter-focus','scatter-focus-value','scatterFocus','fold-scatter-focus-v1',null,0,4);
bindShapeControl('scatter-x','scatter-x-value','scatterX','fold-scatter-x-v1',null,0,4);
bindShapeControl('scatter-y','scatter-y-value','scatterY','fold-scatter-y-v1',null,0,2);
bindShapeControl('grazing-range','grazing-range-value','grazingRange','fold-grazing-range-v1',null,0.25,0.75);
bindShapeControl('edge-softness','edge-softness-value','edgeSoftness','fold-edge-softness-v1',null,0.5,1.5);
bindShapeControl('blur-blend','blur-blend-value','blurBlend','fold-blur-blend-v1',null,0.4,1);
bindShapeControl('follow-smooth','follow-smooth-value','followSmooth','fold-follow-smooth-v1',null,10,60);
$('reset-effects').addEventListener('click', () => {
  applyBlurStrength(50);
  try { localStorage.setItem('fold-blur-strength-v2','50'); } catch {}
  effectResets.forEach(reset => reset());
  status('已恢复默认效果：所有效果参数均为 50%。');
});

const sample = new Image(); sample.onload = () => renderer.setImage(sample); sample.src = "./sample.svg";
function status(message) { $('status').textContent = message; }
function pause() { enabled = false; $('motion').textContent = '开启体感'; }
function animate(time) {
  const dt = Math.min(64, time - (previousTime || time)); previousTime = time;
  current += (target - current) * (1 - Math.exp(-dt / renderer.followSmooth));
  if (Math.abs(target - current) < .0001) current = target;
  renderer.draw(current);
  $('percent').textContent = `${current < -.005 ? '左 ' : current > .005 ? '右 ' : ''}${Math.round(Math.abs(current) * rangeDegrees)}°`;
  if (enabled) $('progress').value = Math.round((target + 1) * 50);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
$('progress').addEventListener('input', e => { pause(); target = (Number(e.target.value) - 50) / 50; status('手动体验中。点“开启体感”可切回左右倾斜。'); });
function calibrate() {
  if (!enabled) { status('请先开启体感，再校准。'); return; }
  tracker.start(); target = 0; measuredAngle = 0;
  status('正在校准：保持你习惯的握持姿势，握稳约 1 秒…');
  $('calibrate').textContent = $('calibrate-full').textContent = '握稳校准中…';
}
window.addEventListener('devicemotion', e => {
  if (!enabled) return;
  const g = e.accelerationIncludingGravity;
  if (!g || ![g.x,g.y,g.z].every(Number.isFinite)) return;
  const a = e.acceleration;
  const gravity = [g.x,g.y,g.z].map((v,i) => v - (a && Number.isFinite(a[['x','y','z'][i]]) ? a[['x','y','z'][i]] : 0));
  const orientation = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
  const [x,y,z] = gravity;
  const result = tracker.update([x*Math.cos(orientation)-y*Math.sin(orientation),x*Math.sin(orientation)+y*Math.cos(orientation),z],performance.now());
  lastSignal = Date.now();
  if (result.edge) status('请不要让手机侧边朝下，换成正常握持姿势后保持不动。');
  if (result.calibrated) {
    $('calibrate').textContent = $('calibrate-full').textContent = '校准归零';
    status('校准完成。角度连续跟手，停在哪里就保持在哪里。');
  }
  if (Number.isFinite(result.angle)) { measuredAngle=result.angle; target=clamp(measuredAngle/rangeDegrees); }
});
$('motion').addEventListener('click', async () => {
  if (enabled) { pause(); status('体感已暂停，可以拖动滑杆。'); return; }
  if (!window.isSecureContext) { status('体感需要安全连接，请打开局域网 HTTPS 地址（8443 端口）。'); return; }
  if (!('DeviceMotionEvent' in window)) { status('当前浏览器不支持体感，请在 iPhone Safari 打开，或使用滑杆。'); return; }
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') { status('未获得体感权限。可使用滑杆，或在 Safari 中重新允许动作与方向访问。'); return; }
    }
    enabled = true; lastSignal = 0; $('motion').textContent = '暂停体感';
    calibrate();
    setTimeout(() => { if (enabled && !lastSignal) { pause(); status('未收到信号：请竖屏拿起手机，并在 Safari 中允许动作与方向访问；也可使用滑杆。'); } }, 3500);
  } catch { status('无法开启体感，请使用 Safari 并允许动作与方向访问。手动滑杆仍可使用。'); }
});
$('calibrate').addEventListener('click', calibrate);
$('calibrate-full').addEventListener('click', e => { e.stopPropagation(); calibrate(); showExit(); });
let savedScrollY = 0;
const immersiveStage = $('stage');
const stagePlaceholder = document.createComment('preview position');
function isStandalone() {
  return Boolean(navigator.standalone || window.matchMedia('(display-mode: standalone)').matches);
}
function fitImmersive() {
  if (!document.body.classList.contains('immersed')) return;
  const standalone = isStandalone();
  document.documentElement.classList.toggle('standalone-immersive', standalone);
  const viewport = window.visualViewport;
  const width = window.innerWidth;
  let height = Math.min(window.innerHeight, viewport?.height || window.innerHeight);
  // In transparent Home Screen mode, a normal document can extend beneath
  // system chrome even when the fixed-position viewport excludes that area.
  // Pair full screen sizing with document positioning, never a fixed root.
  if (standalone && /iPhone|iPod/.test(navigator.userAgent)) {
    const landscape = width > window.innerHeight;
    const sw = landscape ? Math.max(screen.width,screen.height) : Math.min(screen.width,screen.height);
    const sh = landscape ? Math.min(screen.width,screen.height) : Math.max(screen.width,screen.height);
    height = Math.round(sh * width / sw);
  }
  document.documentElement.style.setProperty('--immersive-height', `${height}px`);
  immersiveStage.style.height = `${height}px`;
  const imageWidth = Math.min(width, height * imageRatio);
  fold.style.width = `${imageWidth}px`;
  fold.style.height = `${imageWidth / imageRatio}px`;

}
function updateLayoutInfo() {
  const rect=immersiveStage.getBoundingClientRect();
  $('layout-info').textContent = `版本：全参数精调 23
模式：${isStandalone()?'主屏幕':'浏览器'}
屏幕：${screen.width} × ${screen.height}
页面：${innerWidth} × ${innerHeight}
可见区域：${Math.round(visualViewport?.width||innerWidth)} × ${Math.round(visualViewport?.height||innerHeight)}
最近画面区域：${Math.round(rect.width)} × ${Math.round(rect.height)}，顶部 ${Math.round(rect.top)}
倾斜：${Math.round(current*90)}°`;
}
$('layout-details').addEventListener('toggle', () => { if(!document.body.classList.contains('immersed')) { if(!$('layout-info').textContent)updateLayoutInfo(); } });
window.visualViewport?.addEventListener('resize', resizeImage);
window.addEventListener('resize', resizeImage);
window.addEventListener('pageshow', resizeImage);
document.addEventListener('visibilitychange', () => { if (!document.hidden) resizeImage(); });
new ResizeObserver(() => { if (document.body.classList.contains('immersed')) resizeImage(); }).observe(immersiveStage);
function resizeImage() {
  fitImmersive();
  if (document.body.classList.contains('immersed')) updateLayoutInfo();
  // Center-crop the single flat screenshot without stretching it.
  const w = fold.clientWidth, h = fold.clientHeight, scale = Math.max(w / imageRatio, h);
  renderer.draw(current);
  surfaces.forEach(s => { s.style.backgroundSize = `${scale * imageRatio}px ${scale}px`; s.style.backgroundPosition = `${(w - scale * imageRatio) / 2}px ${(h - scale) / 2}px`; });
}
new ResizeObserver(resizeImage).observe(fold);
$('file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.size > 35 * 1024 * 1024) { status('图片太大，请选择小于 35 MB 的截图。'); e.target.value = ''; return; }
  const url = URL.createObjectURL(file), img = new Image();
  try {
    img.src = url; await img.decode();
    // Downsample large photos locally to bound rendering memory on a phone.
    const canvas = document.createElement('canvas'); const ratio = Math.min(1, 2600 / Math.max(img.width,img.height));
    canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.94));
    if (!blob) throw new Error('decode');
    const next = URL.createObjectURL(blob); surfaces.forEach(s => s.style.backgroundImage = `url("${next}")`);
    if (activeURL) URL.revokeObjectURL(activeURL); activeURL = next; imageRatio = img.width / img.height; renderer.setImage(canvas); resizeImage();
    status('截图已载入，仅在本机显示。点“沉浸体验”让画面铺满屏幕。');
  } catch { status('无法读取这张图片，请换成 PNG 或 JPEG 截图。'); }
  finally { URL.revokeObjectURL(url); e.target.value = ''; }
});
function showExit() { document.body.classList.add('show-exit'); clearTimeout(exitTimer); exitTimer = setTimeout(() => document.body.classList.remove('show-exit'), 3000); }
$('immersive').addEventListener('click', async () => {
  savedScrollY = window.scrollY;
  immersiveStage.before(stagePlaceholder);
  document.body.appendChild(immersiveStage);
  document.body.classList.add('immersed');
  window.scrollTo(0, 0); fitImmersive(); showExit();
  if (!window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches && document.documentElement.requestFullscreen) { try { await document.documentElement.requestFullscreen(); } catch {} }
  resizeImage();
});
$('stage').addEventListener('click', () => { if (document.body.classList.contains('immersed')) showExit(); });
function exitImmersive() { if (!document.body.classList.contains('immersed')) return; document.body.classList.remove('immersed','show-exit'); document.documentElement.classList.remove('standalone-immersive'); document.documentElement.style.removeProperty('--immersive-height'); stagePlaceholder.replaceWith(immersiveStage); clearTimeout(exitTimer); $('stage').style.cssText = ''; fold.style.width = ''; fold.style.height = ''; resizeImage(); window.scrollTo(0, savedScrollY); }
$('exit').addEventListener('click', async e => { e.stopPropagation(); exitImmersive(); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) exitImmersive(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') exitImmersive(); });
window.addEventListener('orientationchange', () => { if (enabled) calibrate(); });

```

## web/icon.svg

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#090b10"/><path d="M28 28l34 10v64L28 90zm38 10l34-10v62l-34 12z" fill="#b2f571"/></svg>

```

## web/index.html

```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090b10"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="折光"><meta name="description" content="选一张截图，左右倾斜手机，体验随手腕变化的折叠动画。"><link rel="manifest" href="./manifest.webmanifest?v=5"><link rel="icon" href="./icon.svg" type="image/svg+xml"><title>折光 · Tilt to fold</title><link rel="stylesheet" href="./style.css"></head>
<body><main id="app">
<header><div><span class="mark">◐</span> 折光 <small>TILT TO FOLD</small></div><button id="immersive" class="quiet">沉浸体验 ↗</button></header>
<section id="stage" aria-label="倾斜翻页效果预览"><div class="ambient"></div><div id="fold"><div class="surface"></div></div><div class="stage-note">左右倾斜，让画面流动</div><button id="calibrate-full" class="full-calibrate">校准归零</button><button id="exit" aria-label="退出沉浸体验">退出</button></section>
<section class="controls"><div class="caption"><h1>让截图轻轻翻过</h1><span id="percent">0°</span></div><p class="intro">近处清晰 · 远处渐糊 · 倾斜越大越明显</p>
<div class="actions"><label class="upload" for="file"><span>＋</span> 选择自己的截图</label><input id="file" type="file" accept="image/*"><button id="motion" class="primary">开启体感</button></div>
<p id="status" role="status" aria-live="polite">先用示例试试，也可以选择相册中的截图。</p>
<div class="slider-label"><label for="blur-strength">模糊强度</label><output id="blur-value" for="blur-strength">50%</output></div><input id="blur-strength" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">围绕你选好的效果精调：50% = 旧版 10%；范围对应旧版 0%–20%。</p><div class="slider-label"><label for="horizontal-stretch">横向拉伸</label><output id="stretch-value" for="horizontal-stretch">50%</output></div><input id="horizontal-stretch" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">围绕你选好的效果微调：50% = 旧版 90%；两端对应旧版 80%–100%。</p><div class="slider-label"><label for="far-shrink">远端内缩</label><output id="shrink-value" for="far-shrink">50%</output></div><input id="far-shrink" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">围绕你选好的效果微调：50% = 旧版 13%；两端对应旧版 0%–26%。</p><details id="advanced-controls"><summary>高级调节</summary><p>每项 50% 都对应当前默认效果，设置自动保存。</p><div class="slider-label"><label for="blur-curve">模糊加速</label><output id="blur-curve-value" for="blur-curve">50%</output></div><input id="blur-curve" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">越高，前期越清晰，模糊越集中在后期。</p><div class="slider-label"><label for="scatter-focus">散射集中度</label><output id="scatter-focus-value" for="scatter-focus">50%</output></div><input id="scatter-focus" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">越高，散射越集中在中心；越低，向周围扩散越均匀。</p><div class="slider-label"><label for="scatter-x">横向散射</label><output id="scatter-x-value" for="scatter-x">50%</output></div><input id="scatter-x" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">控制倾斜后模糊向左右扩展的程度。</p><div class="slider-label"><label for="scatter-y">纵向散射</label><output id="scatter-y-value" for="scatter-y">50%</output></div><input id="scatter-y" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">控制倾斜后模糊向上下扩展的程度。</p><div class="slider-label"><label for="grazing-range">大角度扩散</label><output id="grazing-range-value" for="grazing-range">50%</output></div><input id="grazing-range" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">越高，接近侧立时允许扩散得越远。</p><div class="slider-label"><label for="edge-softness">边缘柔化</label><output id="edge-softness-value" for="edge-softness">50%</output></div><input id="edge-softness" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">调整轮廓的柔和程度；边缘仍会跟随内容渐糊。</p><div class="slider-label"><label for="blur-blend">细节融合</label><output id="blur-blend-value" for="blur-blend">50%</output></div><input id="blur-blend" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">越高，模糊细节融合得越充分；越低，保留更多纹理。</p><div class="slider-label"><label for="follow-smooth">跟手平滑</label><output id="follow-smooth-value" for="follow-smooth">50%</output></div><input id="follow-smooth" type="range" min="0" max="100" step="1" value="50"><p class="sensitivity-note">越低响应越快；越高变化越柔和。</p></details><button id="reset-effects" class="calibration">所有效果恢复 50%</button><button id="calibrate" class="calibration">校准归零</button><p class="sensitivity-note">角度一一对应：0° 清晰 · 随倾斜渐糊</p><div class="slider-label"><label for="progress">手动体验</label></div><input id="progress" type="range" min="0" max="100" value="50" aria-label="左右倾斜程度"><div class="range-ends"><span>左倾</span><span>居中清晰</span><span>右倾</span></div>
<details><summary>全屏打开与使用说明</summary><p>在 iPhone Safari 中，点“分享”→“添加到主屏幕”，再从主屏幕打开。进入沉浸体验后，轻点画面可显示校准和退出按钮。</p><p>竖屏握持，以校准姿势为 0°，左右倾斜角度直接对应画面效果；模糊程度随倾斜角度与模糊强度变化。开启体感后握稳约 1 秒，将当前姿势设为清晰的基准面；手动拖动滑杆会暂停体感。前后倾斜不会用于控制动画。</p><p>图片仅在本机处理，不会发送到服务器。刷新后需重新选择。建议使用 PNG 或 JPEG 截图。</p><p>这是按离基准面距离变化的渐变模糊过渡，不会改变系统桌面。</p></details>
<details id="layout-details"><summary>屏幕适配信息</summary><pre id="layout-info"></pre></details><footer><span>截图留在本机</span><span>为单手体验而做</span></footer></section></main><script src="./render.js"></script><script src="./motion.js"></script><script src="./app.js"></script></body></html>

```

## web/manifest.webmanifest

```json
{"name": "折光 · 左右倾斜体验", "short_name": "折光", "start_url": "./?homescreen=5", "scope": "./", "display": "standalone", "background_color": "#000000", "theme_color": "#090b10", "icons": [{"src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}]}
```

## web/motion.js

```javascript
// A calibrated gravity frame avoids the singularity of atan2(x,y) near flat.
class TiltTracker {
  constructor(){this.base=null;this.side=null;this.samples=[];this.since=0;this.calibrating=false;this.filtered=null;this.time=0;this.angle=0;}
  static dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0);}
  static unit(a){const n=Math.hypot(...a);return n>.001?a.map(v=>v/n):null;}
  start(){this.samples=[];this.since=0;this.calibrating=true;this.filtered=null;this.time=0;}
  update(vector,time){
    const magnitude=Math.hypot(...vector);
    if(!Number.isFinite(magnitude)||magnitude<6||magnitude>14)return {invalid:true};
    const raw=TiltTracker.unit(vector);
    const dt=this.time?Math.max(1,Math.min(100,time-this.time)):16;this.time=time;
    const blend=1-Math.exp(-dt/45);
    this.filtered=this.filtered?TiltTracker.unit(raw.map((v,i)=>this.filtered[i]+(v-this.filtered[i])*blend)):raw;
    if(this.calibrating){
      if(this.samples.length && TiltTracker.dot(raw,this.samples[0])<Math.cos(2.5*Math.PI/180)){this.samples=[];this.since=0;}
      if(!this.samples.length)this.since=time;
      this.samples.push(raw);
      if(time-this.since<800||this.samples.length<12)return {calibrating:true};
      const b=TiltTracker.unit([0,1,2].map(i=>this.samples.reduce((s,v)=>s+v[i],0)));
      // Reject a phone resting on its left/right edge, where gravity cannot
      // establish a reliable sideways rotation axis.
      if(Math.abs(b[0])>.9){this.samples=[];return {calibrating:true,edge:true};}
      this.base=b;this.side=TiltTracker.unit([1,0,0].map((v,i)=>v-b[0]*b[i]));
      this.filtered=b;this.calibrating=false;this.angle=0;return {angle:0,calibrated:true};
    }
    if(!this.base)return {};
    const x=TiltTracker.dot(this.filtered,this.side),y=TiltTracker.dot(this.filtered,this.base);
    if(Math.hypot(x,y)<.25)return {invalid:true};
    const angle=Math.atan2(x,y)*180/Math.PI;
    // Keep the calibrated zero fixed. No auto-recentering or gyro integration.
    this.angle=Math.max(-90,Math.min(90,angle));return {angle:this.angle};
  }
}
if(typeof module!=='undefined')module.exports=TiltTracker;

```

## web/render.js

```javascript
// Depth-dependent focus on one flat screen. No physical phone mesh is rendered.
class DepthRenderer {
  constructor(host) {
    this.host=host; this.blurStrength=.1; this.horizontalStretch=.9; this.farShrink=.13; this.amount=0; this.image=null;
    this.blurCurve=2;this.scatterFocus=2;this.scatterX=2;this.scatterY=1;this.grazingRange=0.5;this.edgeSoftness=1;this.blurBlend=0.7;this.followSmooth=35;
    this.canvas=document.createElement('canvas'); this.canvas.setAttribute('aria-hidden','true');
    this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%';
    this.gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});
    if(!this.gl) return;
    const gl=this.gl;
    const vertex=`#version 300 es
    in vec2 pos; out vec2 uv; void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0.,1.);}`;
    const fragment=`#version 300 es
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
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    try{
      const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader link failed');
      this.program=program;gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.locations={};for(const key of ['blurCurve','scatterFocus','scatterX','scatterY','grazingRange','edgeSoftness','blurBlend','tilt','blurStrength','horizontalStretch','farShrink','viewSize','imageSize'])this.locations[key]=gl.getUniformLocation(program,key);
      host.appendChild(this.canvas);
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.canvas.style.display='none';});
      this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
    }catch(error){console.error(error);this.gl=null;}
  }
  setImage(image){
    this.image=image;if(!this.gl)return;
    const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);this.draw(this.amount);
  }
  draw(amount){
    this.amount=amount;if(!this.gl||!this.image)return;
    const gl=this.gl, ratio=Math.min(window.devicePixelRatio||1,1.5);
    const width=Math.max(1,Math.round(this.host.clientWidth*ratio)),height=Math.max(1,Math.round(this.host.clientHeight*ratio));
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;gl.viewport(0,0,width,height);}
    gl.uniform1f(this.locations.blurCurve,this.blurCurve);gl.uniform1f(this.locations.scatterFocus,this.scatterFocus);gl.uniform1f(this.locations.scatterX,this.scatterX);gl.uniform1f(this.locations.scatterY,this.scatterY);gl.uniform1f(this.locations.grazingRange,this.grazingRange);gl.uniform1f(this.locations.edgeSoftness,this.edgeSoftness);gl.uniform1f(this.locations.blurBlend,this.blurBlend);
    gl.uniform1f(this.locations.horizontalStretch,this.horizontalStretch);gl.uniform1f(this.locations.farShrink,this.farShrink);gl.uniform1f(this.locations.blurStrength,this.blurStrength);gl.uniform1f(this.locations.tilt,amount);gl.uniform2f(this.locations.viewSize,this.host.clientWidth,this.host.clientHeight);gl.uniform2f(this.locations.imageSize,this.image.width,this.image.height);gl.drawArrays(gl.TRIANGLES,0,6);
  }
}

```

## web/sample.svg

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="393" height="852" viewBox="0 0 393 852"><defs><linearGradient id="a" x2=".7" y2="1"><stop stop-color="#12242f"/><stop offset=".48" stop-color="#47615e"/><stop offset="1" stop-color="#c8dc8d"/></linearGradient><radialGradient id="b"><stop stop-color="#e1ffbd" stop-opacity=".65"/><stop offset="1" stop-color="#e1ffbd" stop-opacity="0"/></radialGradient></defs><path fill="url(#a)" d="M0 0h393v852H0z"/><ellipse fill="url(#b)" cx="0" cy="600" rx="400" ry="450"/><g fill="none" stroke="#efffd5" stroke-opacity=".2"><path d="M-160 850Q460 600 140-90M-100 880Q520 600 200-90M-40 910Q580 600 260-90M20 940Q640 600 320-90" stroke-width="2"/></g><g fill="#f4ffec" text-anchor="middle" font-family="sans-serif"><text x="196" y="110" font-size="15" letter-spacing="5">TILT TO FOLD</text><text x="196" y="232" font-size="84" font-weight="200">09:41</text><text x="196" y="272" font-size="18">近处清晰，远处朦胧</text><text x="196" y="730" font-size="18" fill="#1e3a30">换上你的截图</text><text x="196" y="760" font-size="13" fill="#345244">让熟悉的画面有一点不同</text></g></svg>

```

## web/style.css

```css
*{box-sizing:border-box}html{color-scheme:dark;background:#090b10}body{margin:0;color:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;-webkit-tap-highlight-color:transparent}button,label,input,summary{touch-action:manipulation}button,input{font:inherit}button{cursor:pointer;color:inherit;border:0}button:focus-visible,label:focus-within,summary:focus-visible{outline:2px solid #b2f571;outline-offset:4px}#app{max-width:1050px;margin:auto;padding: max(20px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 390px;gap:40px}header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;font-size:20px;font-weight:600}header small{font-size:12px;letter-spacing:2px;color:#7e8493;margin-left:12px}.mark{color:#b2f571;font-size:25px;vertical-align:middle;margin-right:8px}.quiet{background:none;color:#adb3c2;font-size:14px;padding:10px 0}.quiet:hover{color:white}#stage{position:relative;height:min(72vh,730px);min-height:420px;display:flex;align-items:center;justify-content:center;isolation:isolate;overflow:hidden;border-radius:28px;background:#0e1118;touch-action:none}.ambient{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#23313880,transparent 65%);z-index:-1}#fold{position:relative;width:min(75%,300px);aspect-ratio:393/852;will-change:transform,filter,opacity;overflow:hidden;border-radius:4px;background:#000}.surface{position:absolute;inset:0;background-image:url('./sample.svg');background-repeat:no-repeat;background-size:100% 100%}.stage-note{position:absolute;bottom:20px;left:0;right:0;text-align:center;color:#727b8b;font-size:13px;letter-spacing:2px}.controls{align-self:center}.caption{display:flex;align-items:center;justify-content:space-between;gap:12px}h1{font-size:26px;letter-spacing:-.8px;font-weight:550;margin:0}#percent{font-size:14px;color:#b2f571;font-variant-numeric:tabular-nums}.intro{color:#a0a7b6;font-size:14px;margin:12px 0 28px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.upload,.primary{min-height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:15px;font-weight:550;padding:12px;cursor:pointer}.upload{background:#202630;border:1px solid #333b48}.upload span{margin-right:6px;font-size:21px;font-weight:400}.primary{background:#b2f571;color:#17210d}.primary:hover{background:#c5ff8f}#file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}#status{min-height:44px;line-height:1.6;color:#959eaf;font-size:14px;margin:15px 0 18px}.slider-label{display:flex;align-items:center;justify-content:space-between;font-size:14px}#progress{width:100%;accent-color:#b2f571;margin:15px 0 5px;height:28px;cursor:pointer}.range-ends{display:flex;justify-content:space-between;color:#757f90;font-size:13px}details{margin-top:28px;border-top:1px solid #252b36;padding-top:20px;color:#929cab;font-size:14px}summary{cursor:pointer;color:#bdc4d0}details p{line-height:1.8}footer{display:flex;justify-content:space-between;font-size:12px;color:#657081;margin-top:30px}#exit{display:none;position:absolute;top:max(16px,env(safe-area-inset-top));right:20px;background:#202630c9;border:1px solid #ffffff30;border-radius:30px;padding:12px 20px;z-index:10;backdrop-filter:blur(10px)}body.immersed{overflow:hidden}body.immersed #app{padding:0;display:block}body.immersed header,body.immersed .controls,body.immersed .stage-note,body.immersed .ambient{display:none}body.immersed #stage{position:fixed;inset:0;height:100dvh;min-height:0;border-radius:0;background:black}body.immersed #fold{width:100%;height:100%;aspect-ratio:auto}body.immersed #fold{border-radius:0}body.immersed.show-exit #exit{display:block}@media(max-width:760px){#app{display:flex;flex-direction:column;gap:22px;padding: max(14px,env(safe-area-inset-top)) 20px max(24px,env(safe-area-inset-bottom))}header{font-size:19px}header small{font-size:10px;letter-spacing:1.5px;margin-left:6px}#stage{height:41dvh;min-height:265px;border-radius:22px}#fold{height:85%;width:auto;aspect-ratio:393/852}.stage-note{font-size:12px;bottom:10px}.controls{width:100%}h1{font-size:23px}.intro{margin:9px 0 20px}#status{margin-bottom:8px}details{margin-top:18px}footer{margin-top:24px}}

.calibration{width:100%;padding:14px;margin:0 0 20px;background:#25332b;color:#c7ff98;border:1px solid #506b42;border-radius:12px;font-size:16px;font-weight:600}#sensitivity{width:100%;accent-color:#b2f571;height:28px;margin:10px 0}.sensitivity-note{font-size:13px;color:#959eaf;margin:0 0 22px}.full-calibrate{display:none;position:absolute;top:max(16px,env(safe-area-inset-top));left:20px;z-index:10;background:#202630df;padding:12px 20px;border:1px solid #ffffff30;border-radius:30px;color:#c7ff98}body.immersed.show-exit .full-calibrate{display:block}

body.immersed #stage{right:auto;bottom:auto;padding:0;margin:0;display:flex;align-items:center;justify-content:center}body.immersed #fold{flex:none;max-width:none;max-height:none;transform:none}html:has(body.immersed){overflow:hidden;overscroll-behavior:none}

/* Immersive content is attached to body, independent of preview layout. */
body.immersed #stage{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;min-height:0;max-height:none;padding:0;margin:0;border:0;border-radius:0;overflow:hidden;display:block;z-index:1000}
body.immersed #fold{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;max-width:none;max-height:none;margin:0;padding:0;aspect-ratio:auto;border-radius:0;transform:none}
@media(display-mode:standalone){body.immersed #stage{height:100lvh}}

/* Give the root scrolling surface the same full height as the painting surface. */
html.standalone-immersive,html.standalone-immersive body{position:fixed;top:0;left:0;right:0;bottom:auto;width:100%;height:var(--immersive-height,100vh);min-height:var(--immersive-height,100vh);margin:0;padding:0;overflow:hidden;background:#000}
html.standalone-immersive body.immersed #stage{top:0;left:0;right:0;bottom:auto;height:var(--immersive-height,100vh)}
#layout-info{white-space:pre-wrap;line-height:1.7;font-size:13px;color:#aeb8c7}

/* Contain the screenshot in the drawable area until edge-to-edge WebView
   behavior is verified on the user's iOS version. */
body.immersed #stage{display:flex;align-items:center;justify-content:center}
body.immersed #fold{position:relative;inset:auto;flex:none}

/* Home Screen: paint in the document instead of a fixed viewport layer. */
html.standalone-immersive{position:static;inset:auto;width:100%;height:var(--immersive-height);min-height:var(--immersive-height);overflow:hidden}
html.standalone-immersive body{position:relative;inset:auto;width:100%;height:var(--immersive-height);min-height:var(--immersive-height);overflow:visible;margin:0;padding:0}
body.immersed #app{display:none}
html.standalone-immersive body.immersed #stage{position:absolute;top:0;left:0;right:auto;bottom:auto;width:100%;height:var(--immersive-height);overflow:hidden}
body.immersed #fold{will-change:auto}

#blur-strength{width:100%;height:32px;accent-color:#b2f571;margin:10px 0;cursor:pointer}#blur-value{color:#b2f571;font-variant-numeric:tabular-nums}

#perspective-strength{width:100%;height:32px;accent-color:#b2f571;margin:10px 0;cursor:pointer}#perspective-value{color:#b2f571;font-variant-numeric:tabular-nums}

#focal-length{width:100%;height:32px;accent-color:#b2f571;margin:10px 0;cursor:pointer}#focal-value{color:#b2f571;font-variant-numeric:tabular-nums}

#horizontal-stretch,#far-shrink{width:100%;height:32px;accent-color:#b2f571;margin:10px 0;cursor:pointer}#stretch-value,#shrink-value{color:#b2f571;font-variant-numeric:tabular-nums}

#advanced-controls input[type="range"]{width:100%;accent-color:#b2f571;height:28px;margin:10px 0}#advanced-controls{margin-bottom:22px}#reset-effects{margin-top:12px}

```
