import { DepthRenderer } from "./DepthRenderer";
import { TiltTracker } from "./TiltTracker";
import { effects, effectValue, readPercent } from "../config/effects";

/** Owns frame-level DOM/WebGL updates and the original Safari immersive positioning. */
export function mountExperience() {
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  let signalTimer: ReturnType<typeof setTimeout> | undefined;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const effectResets: Array<() => void> = [];
  const fold = $("fold");
  const surfaces = [...document.querySelectorAll<HTMLElement>(".surface")];
  let target = 0,
    current = 0,
    enabled = false,
    lastSignal = 0,
    exitTimer: ReturnType<typeof setTimeout> | undefined,
    previousTime = 0,
    activeURL: string | null = null,
    imageRatio = 393 / 852;
  const tracker = new TiltTracker();
  const rangeDegrees = 90;
  let measuredAngle = 0;
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const renderer = new DepthRenderer(fold);
  for (const effect of effects) {
    const input = $<HTMLInputElement>(effect.id);
    const apply = (percent: number) => {
      const value =
        effect.property === "blurStrength" ? percent : Math.round(percent);
      renderer[effect.property] = effectValue(effect, value);
      input.value = String(value);
      $(effect.outputId).textContent = `${value}%`;
      renderer.draw(current);
    };
    apply(readPercent(effect));
    input.addEventListener(
      "input",
      () => {
        apply(Number(input.value));
        try {
          localStorage.setItem(effect.storageKey, input.value);
        } catch {}
      },
      { signal },
    );
    effectResets.push(() => {
      apply(50);
      try {
        localStorage.setItem(effect.storageKey, "50");
      } catch {}
    });
  }
  $("reset-effects").addEventListener(
    "click",
    () => {
      effectResets.forEach((reset) => reset());
      status("已恢复默认效果。");
    },
    { signal },
  );

  const sample = new Image();
  sample.onload = () => renderer.setImage(sample);
  sample.src = `${import.meta.env.BASE_URL}sample.svg`;
  function status(message: string) {
    $("status").textContent = message;
  }
  function pause() {
    enabled = false;
    $("motion").textContent = "开启体感";
  }
  function animate(time: number) {
    const dt = Math.min(64, time - (previousTime || time));
    previousTime = time;
    current += (target - current) * (1 - Math.exp(-dt / renderer.followSmooth));
    if (Math.abs(target - current) < 0.0001) current = target;
    renderer.draw(current);
    $("percent").textContent =
      `${current < -0.005 ? "左 " : current > 0.005 ? "右 " : ""}${Math.round(Math.abs(current) * rangeDegrees)}°`;
    if (enabled)
      $<HTMLInputElement>("progress").value = String(
        Math.round((target + 1) * 50),
      );
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  $<HTMLInputElement>("progress").addEventListener(
    "input",
    (e) => {
      pause();
      target = (Number((e.target as HTMLInputElement).value) - 50) / 50;
      status("手动体验中，点击“开启体感”可切换。");
    },
    { signal },
  );
  function calibrate() {
    if (!enabled) {
      status("请先开启体感，再校准。");
      return;
    }
    tracker.start();
    target = 0;
    measuredAngle = 0;
    status("正在校准，请握稳约 1 秒…");
    $("calibrate").textContent = $("calibrate-full").textContent =
      "握稳校准中…";
  }
  window.addEventListener(
    "devicemotion",
    (e) => {
      if (!enabled) return;
      const g = e.accelerationIncludingGravity;
      if (!g || ![g.x, g.y, g.z].every(Number.isFinite)) return;
      const a = e.acceleration;
      const gravity = [g.x, g.y, g.z].map(
        (v, i) =>
          v! -
          (a && Number.isFinite(a[(["x", "y", "z"] as const)[i]])
            ? a[(["x", "y", "z"] as const)[i]]!
            : 0),
      );
      const orientation =
        ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) /
        180;
      const [x, y, z] = gravity;
      const result = tracker.update(
        [
          x * Math.cos(orientation) - y * Math.sin(orientation),
          x * Math.sin(orientation) + y * Math.cos(orientation),
          z,
        ],
        performance.now(),
      );
      lastSignal = Date.now();
      if (result.edge) status("请竖屏握稳，避免手机侧边朝下。");
      if (result.calibrated) {
        $("calibrate").textContent = $("calibrate-full").textContent =
          "校准归零";
        status("校准完成，左右倾斜试试。");
      }
      if (Number.isFinite(result.angle)) {
        measuredAngle = result.angle!;
        target = clamp(measuredAngle / rangeDegrees);
      }
    },
    { signal },
  );
  $("motion").addEventListener(
    "click",
    async () => {
      if (enabled) {
        pause();
        status("体感已暂停，可拖动滑杆体验。");
        return;
      }
      if (!window.isSecureContext) {
        status("请通过 HTTPS 地址打开页面，再开启体感。");
        return;
      }
      if (!("DeviceMotionEvent" in window)) {
        status("当前浏览器不支持体感，请使用 iPhone Safari 或拖动滑杆。");
        return;
      }
      try {
        const MotionEvent = DeviceMotionEvent as typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<string>;
        };
        if (typeof MotionEvent.requestPermission === "function") {
          const permission = await MotionEvent.requestPermission();
          if (signal.aborted) return;
          if (permission !== "granted") {
            status("未获得体感权限，请允许动作与方向访问，或拖动滑杆体验。");
            return;
          }
        }
        enabled = true;
        lastSignal = 0;
        $("motion").textContent = "暂停体感";
        calibrate();
        signalTimer = setTimeout(() => {
          if (enabled && !lastSignal) {
            pause();
            status("未收到体感信号，请检查动作与方向权限，或拖动滑杆体验。");
          }
        }, 3500);
      } catch {
        status("体感开启失败，请用 Safari 重试，或拖动滑杆体验。");
      }
    },
    { signal },
  );
  $("calibrate").addEventListener("click", calibrate, { signal });
  $("calibrate-full").addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      calibrate();
      showExit();
    },
    { signal },
  );
  let savedScrollY = 0;
  const immersiveStage = $("stage");
  const stagePlaceholder = document.createComment("preview position");
  function isStandalone() {
    return Boolean(
      navigator.standalone ||
      window.matchMedia("(display-mode: standalone)").matches,
    );
  }
  function fitImmersive() {
    if (!document.body.classList.contains("immersed")) return;
    const standalone = isStandalone();
    document.documentElement.classList.toggle(
      "standalone-immersive",
      standalone,
    );
    const viewport = window.visualViewport;
    const width = window.innerWidth;
    let height = Math.min(
      window.innerHeight,
      viewport?.height || window.innerHeight,
    );
    // In transparent Home Screen mode, a normal document can extend beneath
    // system chrome even when the fixed-position viewport excludes that area.
    // Pair full screen sizing with document positioning, never a fixed root.
    if (standalone && /iPhone|iPod/.test(navigator.userAgent)) {
      const landscape = width > window.innerHeight;
      const sw = landscape
        ? Math.max(screen.width, screen.height)
        : Math.min(screen.width, screen.height);
      const sh = landscape
        ? Math.min(screen.width, screen.height)
        : Math.max(screen.width, screen.height);
      height = Math.round((sh * width) / sw);
    }
    document.documentElement.style.setProperty(
      "--immersive-height",
      `${height}px`,
    );
    immersiveStage.style.height = `${height}px`;
    const imageWidth = Math.min(width, height * imageRatio);
    fold.style.width = `${imageWidth}px`;
    fold.style.height = `${imageWidth / imageRatio}px`;
  }
  function updateLayoutInfo() {
    const rect = immersiveStage.getBoundingClientRect();
    $("layout-info").textContent = `显示信息
模式：${isStandalone() ? "主屏幕" : "浏览器"}
屏幕：${screen.width} × ${screen.height}
页面：${innerWidth} × ${innerHeight}
可见区域：${Math.round(visualViewport?.width || innerWidth)} × ${Math.round(visualViewport?.height || innerHeight)}
最近画面区域：${Math.round(rect.width)} × ${Math.round(rect.height)}，顶部 ${Math.round(rect.top)}
倾斜：${Math.round(current * 90)}°`;
  }
  $("layout-details").addEventListener(
    "toggle",
    () => {
      if (!document.body.classList.contains("immersed")) {
        if (!$("layout-info").textContent) updateLayoutInfo();
      }
    },
    { signal },
  );
  window.visualViewport?.addEventListener("resize", resizeImage, { signal });
  window.addEventListener("resize", resizeImage, { signal });
  window.addEventListener("pageshow", resizeImage, { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) resizeImage();
    },
    { signal },
  );
  const stageObserver = new ResizeObserver(() => {
    if (document.body.classList.contains("immersed")) resizeImage();
  });
  stageObserver.observe(immersiveStage);
  function resizeImage() {
    fitImmersive();
    if (document.body.classList.contains("immersed")) updateLayoutInfo();
    // Center-crop the single flat screenshot without stretching it.
    const w = fold.clientWidth,
      h = fold.clientHeight,
      scale = Math.max(w / imageRatio, h);
    renderer.draw(current);
    surfaces.forEach((s) => {
      s.style.backgroundSize = `${scale * imageRatio}px ${scale}px`;
      s.style.backgroundPosition = `${(w - scale * imageRatio) / 2}px ${(h - scale) / 2}px`;
    });
  }
  const foldObserver = new ResizeObserver(resizeImage);
  foldObserver.observe(fold);
  $<HTMLInputElement>("file").addEventListener(
    "change",
    async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 35 * 1024 * 1024) {
        status("图片太大，请选择小于 35 MB 的截图。");
        (e.target as HTMLInputElement).value = "";
        return;
      }
      const url = URL.createObjectURL(file),
        img = new Image();
      try {
        img.src = url;
        await img.decode();
        if (signal.aborted) return;
        // Downsample large photos locally to bound rendering memory on a phone.
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, 2600 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.94),
        );
        if (signal.aborted) return;
        if (!blob) throw new Error("decode");
        const next = URL.createObjectURL(blob);
        surfaces.forEach((s) => (s.style.backgroundImage = `url("${next}")`));
        if (activeURL) URL.revokeObjectURL(activeURL);
        activeURL = next;
        imageRatio = img.width / img.height;
        renderer.setImage(canvas);
        resizeImage();
        status("截图已载入，点击“沉浸体验”查看。");
      } catch {
        status("图片读取失败，请换一张 PNG 或 JPEG 图片。");
      } finally {
        URL.revokeObjectURL(url);
        (e.target as HTMLInputElement).value = "";
      }
    },
    { signal },
  );
  function showExit() {
    document.body.classList.add("show-exit");
    clearTimeout(exitTimer);
    exitTimer = setTimeout(
      () => document.body.classList.remove("show-exit"),
      3000,
    );
  }
  $("immersive").addEventListener(
    "click",
    async () => {
      savedScrollY = window.scrollY;
      immersiveStage.before(stagePlaceholder);
      document.body.appendChild(immersiveStage);
      document.body.classList.add("immersed");
      window.scrollTo(0, 0);
      fitImmersive();
      showExit();
      if (
        !window.navigator.standalone &&
        !window.matchMedia("(display-mode: standalone)").matches &&
        document.documentElement.requestFullscreen
      ) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {}
      }
      resizeImage();
    },
    { signal },
  );
  $("stage").addEventListener(
    "click",
    () => {
      if (document.body.classList.contains("immersed")) showExit();
    },
    { signal },
  );
  function exitImmersive() {
    if (!document.body.classList.contains("immersed")) return;
    document.body.classList.remove("immersed", "show-exit");
    document.documentElement.classList.remove("standalone-immersive");
    document.documentElement.style.removeProperty("--immersive-height");
    stagePlaceholder.replaceWith(immersiveStage);
    clearTimeout(exitTimer);
    $("stage").style.cssText = "";
    fold.style.width = "";
    fold.style.height = "";
    resizeImage();
    window.scrollTo(0, savedScrollY);
  }
  $("exit").addEventListener(
    "click",
    async (e) => {
      e.stopPropagation();
      exitImmersive();
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
    },
    { signal },
  );
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (!document.fullscreenElement) exitImmersive();
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") exitImmersive();
    },
    { signal },
  );
  window.addEventListener(
    "orientationchange",
    () => {
      if (enabled) calibrate();
    },
    { signal },
  );

  return () => {
    controller.abort();
    cancelAnimationFrame(frame);
    clearTimeout(signalTimer);
    clearTimeout(exitTimer);
    stageObserver.disconnect();
    foldObserver.disconnect();
    sample.onload = null;
    exitImmersive();
    if (activeURL) URL.revokeObjectURL(activeURL);
    renderer.dispose();
  };
}
