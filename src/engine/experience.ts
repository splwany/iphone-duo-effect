import { mountImmersive } from "./immersive";
import { createFoldEffect, GravityInput } from "../sdk";
import { mountEffectControls } from "./effectControls";

/** Composes the demo: input permissions, local image upload and presentation. */
export function mountExperience() {
  const controller = new AbortController();
  const { signal } = controller;
  let signalTimer: ReturnType<typeof setTimeout> | undefined;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const fold = $("fold");
  const surfaces = [...document.querySelectorAll<HTMLElement>(".surface")];
  let enabled = false,
    lastSignal = 0,
    activeURL: string | null = null,
    imageRatio = 393 / 852;
  const gravityInput = new GravityInput();
  const rangeDegrees = 90;
  const effectPlayer = createFoldEffect(fold);
  mountEffectControls(effectPlayer, signal, status);

  const sample = new Image();
  sample.onload = () => effectPlayer.setImage(sample);
  sample.src = `${import.meta.env.BASE_URL}sample.svg`;
  function status(message: string) {
    $("status").textContent = message;
  }
  function pause() {
    enabled = false;
    $("motion").textContent = "开启体感";
  }
  effectPlayer.subscribe(({ progress, targetProgress }) => {
    $("percent").textContent =
      `${progress < -0.005 ? "左 " : progress > 0.005 ? "右 " : ""}${Math.round(Math.abs(progress) * rangeDegrees)}°`;
    if (enabled)
      $<HTMLInputElement>("progress").value = String(
        Math.round((targetProgress + 1) * 50),
      );
  });
  $<HTMLInputElement>("progress").addEventListener(
    "input",
    (e) => {
      pause();
      effectPlayer.setProgress(
        (Number((e.target as HTMLInputElement).value) - 50) / 50,
      );
      status("手动体验中，点击“开启体感”可切换。");
    },
    { signal },
  );
  function calibrate() {
    if (!enabled) {
      status("请先开启体感，再校准。");
      return;
    }
    gravityInput.calibrate();
    effectPlayer.setProgress(0);
    status("正在校准，请握稳约 1 秒…");
    $("calibrate").textContent = $("calibrate-full").textContent =
      "握稳校准中…";
  }
  window.addEventListener(
    "devicemotion",
    (e) => {
      if (!enabled) return;
      const result = gravityInput.update(
        e,
        performance.now(),
        screen.orientation?.angle ?? window.orientation ?? 0,
      );
      if (!result) return;
      lastSignal = Date.now();
      if (result.edge) status("请竖屏握稳，避免手机侧边朝下。");
      if (result.calibrated) {
        $("calibrate").textContent = $("calibrate-full").textContent =
          "校准归零";
        status("校准完成，左右倾斜试试。");
      }
      if (result.progress !== undefined)
        effectPlayer.setProgress(result.progress);
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
      immersive.showControls();
    },
    { signal },
  );
  const immersiveStage = $("stage");
  const immersive = mountImmersive({
    fold,
    stage: immersiveStage,
    signal,
    getImageRatio: () => imageRatio,
    getAngle: () => effectPlayer.state.angle,
    resizeImage,
  });
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
    immersive.resize();
    // Center-crop the single flat screenshot without stretching it.
    const w = fold.clientWidth,
      h = fold.clientHeight,
      scale = Math.max(w / imageRatio, h);
    effectPlayer.resize();
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
        effectPlayer.setImage(canvas);
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
  window.addEventListener(
    "orientationchange",
    () => {
      if (enabled) calibrate();
    },
    { signal },
  );

  return () => {
    controller.abort();
    clearTimeout(signalTimer);
    stageObserver.disconnect();
    foldObserver.disconnect();
    sample.onload = null;
    immersive.dispose();
    if (activeURL) URL.revokeObjectURL(activeURL);
    effectPlayer.dispose();
  };
}
