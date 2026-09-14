import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:8765/");
  const baselinePng = process.env.PARAM_BASELINE
    ? "data:image/png;base64," +
      (await readFile(process.env.PARAM_BASELINE)).toString("base64")
    : null;
  const result = await page.evaluate(async (baselinePng) => {
    const { DepthRenderer } = await import("/src/engine/DepthRenderer.ts");
    const { effects, effectValue } = await import("/src/config/effects.ts");
    const { rasterizeImage } = await import("/src/engine/image.ts");
    const sample = new Image();
    sample.src = "/sample.svg";
    await sample.decode();
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;top:0;left:0;width:180px;height:390px";
    document.body.append(host);
    const renderer = new DepthRenderer(host);
    renderer.setImage(rasterizeImage(sample));
    const gl = renderer.gl;
    if (!gl) throw Error("WebGL unavailable");
    const read = () => {
      const p = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p,
      );
      return p;
    };
    const reset = () =>
      effects.forEach((e) => (renderer[e.property] = effectValue(e, 50)));
    const difference = (a, b) => {
      let sum = 0,
        n = 0,
        changed = 0;
      for (let i = 0; i < a.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 3; c++) delta += Math.abs(a[i + c] - b[i + c]);
        sum += delta;
        n += 3;
        if (delta / 3 > 8) changed++;
      }
      return {
        mean: +(sum / n).toFixed(3),
        changed: +((changed / (a.length / 4)) * 100).toFixed(2),
      };
    };
    const rows = [];
    const atlas = document.createElement("canvas");
    atlas.width = 540;
    atlas.height = 430 * 10;
    const ctx = atlas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "white";
    for (const [index, e] of effects
      .filter((e) => e.property !== "followSmooth")
      .entries()) {
      const angles = {};
      for (const angle of [0, 15, 45, 75]) {
        reset();
        const images = [];
        for (const percent of [0, 50, 100]) {
          renderer[e.property] = effectValue(e, percent);
          renderer.draw(angle / 90);
          images.push(read());
          if (angle === 45) {
            const col = percent / 50;
            ctx.drawImage(
              renderer.canvas,
              col * 180,
              index * 430 + 40,
              180,
              390,
            );
            ctx.fillText(
              `${e.label} ${percent}%`,
              col * 180 + 3,
              index * 430 + 25,
            );
          }
        }
        angles[angle] = {
          endpoints: difference(images[0], images[2]),
          low: difference(images[0], images[1]),
          high: difference(images[1], images[2]),
        };
      }
      rows.push({ id: e.id, angles });
    }
    // White is useful for isolating silhouette changes from image detail.
    const white = document.createElement("canvas");
    white.width = 393;
    white.height = 852;
    const c = white.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, 393, 852);
    renderer.setImage(white);
    reset();
    const edge = effects.find((e) => e.property === "edgeSoftness");
    const pixels = [];
    for (const percent of [0, 50, 100]) {
      renderer.edgeSoftness = effectValue(edge, percent);
      renderer.draw(0.5);
      pixels.push(read());
    }
    const edgeWhite = {
      endpoints: difference(pixels[0], pixels[2]),
      low: difference(pixels[0], pixels[1]),
      high: difference(pixels[1], pixels[2]),
    };
    const error = gl.getError();
    renderer.dispose();
    host.remove();
    let defaultPixelDifference = null;
    if (baselinePng) {
      const old = new Image();
      old.src = baselinePng;
      await old.decode();
      const canvas = document.createElement("canvas");
      canvas.width = atlas.width;
      canvas.height = atlas.height;
      const oldCtx = canvas.getContext("2d");
      oldCtx.drawImage(old, 0, 0);
      defaultPixelDifference = difference(
        ctx.getImageData(180, 0, 180, atlas.height).data,
        oldCtx.getImageData(180, 0, 180, atlas.height).data,
      );
    }
    return {
      rows,
      edgeWhite,
      error,
      defaultPixelDifference,
      atlas: atlas.toDataURL("image/png"),
    };
  }, baselinePng);
  assert.equal(result.error, 0);
  if (baselinePng)
    assert.equal(
      result.defaultPixelDifference.mean,
      0,
      "50% visual baseline changed",
    );
  assert(
    result.edgeWhite.endpoints.changed > 8,
    "edge endpoints need a visible silhouette difference",
  );
  for (const [id, mean] of [
    ["edge-softness", 2],
    ["blur-blend", 3],
    ["scatter-focus", 1.5],
    ["horizontal-stretch", 7],
  ]) {
    assert(
      result.rows.find((row) => row.id === id).angles[45].endpoints.mean > mean,
      `${id} endpoint effect too weak`,
    );
  }
  const motionPage = await browser.newPage();
  await motionPage.addInitScript(() => {
    let id = 0;
    window.pendingFrames = new Map();
    window.requestAnimationFrame = (callback) => {
      window.pendingFrames.set(++id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => window.pendingFrames.delete(id);
  });
  await motionPage.goto("http://127.0.0.1:8765/");
  await motionPage.waitForSelector("#fold canvas");
  result.followResponse = await motionPage.evaluate(() => {
    let time = 1000;
    const tick = (dt) => {
      time += dt;
      const callbacks = [...window.pendingFrames.values()];
      window.pendingFrames.clear();
      callbacks.forEach((callback) => callback(time));
    };
    const set = (id, value) => {
      const input = document.getElementById(id);
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const angle = () =>
      Number(document.getElementById("percent").textContent.match(/\d+/)[0]);
    tick(16);
    set("follow-smooth", 0);
    set("progress", 100);
    tick(64);
    const fast = angle();
    set("progress", 50);
    for (let i = 0; i < 20; i++) tick(16);
    set("follow-smooth", 100);
    set("progress", 100);
    tick(64);
    return { fast, slow: angle() };
  });
  assert(
    result.followResponse.fast >= 85 && result.followResponse.slow <= 25,
    "follow speed endpoints must be distinct during motion",
  );
  await motionPage.close();
  const prefix = process.env.PARAM_OUTPUT || "/tmp/duo-parameters";
  await writeFile(
    prefix + ".png",
    Buffer.from(result.atlas.split(",")[1], "base64"),
  );
  delete result.atlas;
  await writeFile(prefix + ".json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      rows: result.rows.map((r) => ({
        id: r.id,
        at15: r.angles[15].endpoints,
        at45: r.angles[45].endpoints,
        at75: r.angles[75].endpoints,
      })),
      edgeWhite: result.edgeWhite,
      error: result.error,
      defaultPixelDifference: result.defaultPixelDifference,
      followResponse: result.followResponse,
    }),
  );
} finally {
  await browser.close();
}
