import { test } from "node:test";
import assert from "node:assert/strict";
import { rasterizeImage } from "../src/engine/image";

test("texture pixels use intrinsic image size, independent of layout and DPR", () => {
  const image = {
    naturalWidth: 393,
    naturalHeight: 852,
    width: 131,
    height: 284,
  } as HTMLImageElement;
  const calls: unknown[][] = [];
  const canvas = {
    width: 300,
    height: 150,
    getContext: () => ({ drawImage: (...args: unknown[]) => calls.push(args) }),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, "canvas");
        return canvas;
      },
    },
  });
  try {
    assert.equal(rasterizeImage(image), canvas);
    assert.equal(canvas.width, 393);
    assert.equal(canvas.height, 852);
    assert.deepEqual(calls, [[image, 0, 0, 393, 852]]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
test("undecoded images cannot create zero-sized textures", () => {
  assert.throws(
    () =>
      rasterizeImage({ naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement),
    /decoded/,
  );
});
