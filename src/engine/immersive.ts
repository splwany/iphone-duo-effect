interface ImmersiveOptions {
  fold: HTMLElement;
  stage: HTMLElement;
  signal: AbortSignal;
  getImageRatio: () => number;
  getAngle: () => number;
  resizeImage: () => void;
}

/** Demo-only full-screen layout, including iPhone Home Screen viewport handling. */
export function mountImmersive({
  fold,
  stage: immersiveStage,
  signal,
  getImageRatio,
  getAngle,
  resizeImage,
}: ImmersiveOptions) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let savedScrollY = 0;
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
    const imageWidth = Math.min(width, height * getImageRatio());
    fold.style.width = `${imageWidth}px`;
    fold.style.height = `${imageWidth / getImageRatio()}px`;
  }
  function updateLayoutInfo() {
    const rect = immersiveStage.getBoundingClientRect();
    $("layout-info").textContent = `显示信息
模式：${isStandalone() ? "主屏幕" : "浏览器"}
屏幕：${screen.width} × ${screen.height}
页面：${innerWidth} × ${innerHeight}
可见区域：${Math.round(visualViewport?.width || innerWidth)} × ${Math.round(visualViewport?.height || innerHeight)}
最近画面区域：${Math.round(rect.width)} × ${Math.round(rect.height)}，顶部 ${Math.round(rect.top)}
倾斜：${Math.round(getAngle())}°`;
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
  return {
    resize() {
      fitImmersive();
      if (document.body.classList.contains("immersed")) updateLayoutInfo();
    },
    showControls: showExit,
    dispose() {
      clearTimeout(exitTimer);
      exitImmersive();
    },
  };
}
