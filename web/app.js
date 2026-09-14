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
