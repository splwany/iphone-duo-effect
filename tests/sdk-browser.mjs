import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/");
  const result = await page.evaluate(async (entry) => {
    const { createFoldEffect, createHingeMapper } = await import(entry);
    const check = (condition, message) => {
      if (!condition) throw Error(message);
    };
    const host = () => {
      const node = document.createElement("div");
      node.style.cssText = "position:relative;width:180px;height:390px";
      document.body.append(node);
      return node;
    };
    const aHost = host(),
      bHost = host();
    const a = createFoldEffect(aHost, {
      autoStart: false,
      parameters: { blurStrength: 0.15 },
    });
    const b = createFoldEffect(bHost, { autoStart: false });
    check(a.supported && b.supported, "WebGL unavailable");
    const sample = new Image();
    sample.src = "/sample.svg";
    await sample.decode();
    a.setImage(sample);
    b.setImage(sample);
    a.setParameters({ blurStrength: 0.1 });
    a.setAngle(45, { immediate: true });
    b.setProgress(createHingeMapper()(90), { immediate: true });
    const pixels = (node) => {
      const gl = node.querySelector("canvas").getContext("webgl2");
      const data = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
      check(gl.getError() === 0, "WebGL error");
      return data;
    };
    const equal = (a, b) =>
      a.length === b.length && a.every((v, i) => v === b[i]);
    a.resize();
    const first = pixels(aHost);
    b.resize();
    check(
      equal(first, pixels(bHost)),
      "Angle and hinge inputs must render identically",
    );
    check(
      first.some((v, i) => i % 4 !== 3 && v > 0),
      "Must render visible content",
    );
    a.resetParameters();
    check(
      a.parameters.blurStrength === 0.15 && b.parameters.blurStrength === 0.1,
      "Instance defaults must be isolated",
    );
    let rejected = false;
    try {
      a.setParameters({ blurStrength: 0.2, scatterX: NaN });
    } catch {
      rejected = true;
    }
    check(
      rejected && a.parameters.blurStrength === 0.15,
      "Invalid update must be atomic",
    );
    let events = 0;
    const off = a.subscribe(() => events++);
    a.setAngle(-45, { immediate: true });
    off();
    a.setAngle(0, { immediate: true });
    check(events === 1, "Unsubscribe must work");
    let stale,
      send,
      disconnected = 0;
    a.connectInput((write) => {
      stale = write;
      return () => disconnected++;
    });
    const disconnect = a.connectInput((write) => {
      send = write;
      return () => disconnected++;
    });
    send(0.8);
    stale(-1);
    check(
      a.state.targetProgress === 0.8 && disconnected === 1,
      "Replace and ignore old input",
    );
    disconnect();
    disconnect();
    check(disconnected === 2, "Input cleanup must be idempotent");
    a.connectInput((write) => {
      send = write;
      return () => disconnected++;
    });
    aHost.style.width = "240px";
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    check(
      aHost.querySelector("canvas").width ===
        Math.round(240 * Math.min(devicePixelRatio, 1.5)),
      "Resize must follow host",
    );
    // Recovery must restore this instance, never reload the embedding page.
    const canvas = bHost.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const loss = gl.getExtension("WEBGL_lose_context");
    if (loss) {
      const lost = new Promise((r) =>
        canvas.addEventListener("webglcontextlost", r, { once: true }),
      );
      loss.loseContext();
      await lost;
      await new Promise((r) => setTimeout(r, 100));
      const restored = new Promise((r) =>
        canvas.addEventListener("webglcontextrestored", r, { once: true }),
      );
      loss.restoreContext();
      await restored;
      b.resize();
      check(
        equal(first, pixels(bHost)),
        "Context recovery must restore pixels",
      );
    }
    a.start();
    a.start();
    a.stop();
    a.start();
    a.dispose();
    a.dispose();
    send(-0.8);
    check(
      disconnected === 3 && !aHost.querySelector("canvas"),
      "Dispose must release input and canvas",
    );
    check(
      bHost.querySelectorAll("canvas").length === 1,
      "Other instance remains alive",
    );
    b.dispose();
    aHost.remove();
    bHost.remove();
    return {
      equivalentPixels: true,
      independentInstances: true,
      contextRestored: Boolean(loss),
      cleanup: true,
    };
  }, process.env.SDK_ENTRY || "/src/sdk/index.ts");
  await page.goto("http://127.0.0.1:8765/examples/basic.html");
  await page.waitForSelector("#preview canvas");
  await page.locator("#hinge").fill("90");
  assert.equal(await page.locator("#angle").textContent(), "90°");
  assert.equal(await page.locator("#status").textContent(), "");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
