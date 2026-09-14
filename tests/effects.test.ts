import { test } from "node:test";
import assert from "node:assert/strict";
import { effects, effectValue, readPercent } from "../src/config/effects";

test("all midpoint values preserve the visual baseline", () => {
  const expected = [0.1, 0.9, 0.13, 2, 2, 2, 1, 0.5, 1, 0.7, 35];
  effects.forEach((effect, i) =>
    assert.equal(effectValue(effect, 50), expected[i]),
  );
});
test("legacy settings migrate to equivalent midpoint values", () => {
  for (const [index, legacy] of [
    [0, "10"],
    [1, "90"],
    [2, "13"],
  ] as const) {
    const effect = effects[index];
    const value = readPercent(effect, {
      getItem: (key) => (key === effect.legacyKey ? legacy : null),
    });
    assert(Math.abs(value - 50) < 1e-10);
  }
});
test("current settings win over legacy, invalid and blocked storage are handled", () => {
  const effect = effects[0];
  assert.equal(
    readPercent(effect, {
      getItem: (key) => (key === effect.storageKey ? "75" : "10"),
    }),
    75,
  );
  assert.equal(readPercent(effect, { getItem: () => "invalid" }), 50);
  assert.equal(readPercent(effect, { getItem: () => "200" }), 100);
  assert.equal(readPercent(effect, { getItem: () => "-1" }), 0);
  assert.equal(
    readPercent(effect, {
      getItem: () => {
        throw Error("blocked");
      },
    }),
    50,
  );
});

test("storage getter failures also retain default settings", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw Error("blocked");
    },
  });
  try {
    assert.equal(readPercent(effects[0]), 50);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("expanded ranges remain continuous, monotonic and invertible", async () => {
  const { effectPercent } = await import("../src/config/effects");
  for (const effect of effects) {
    let previous = -Infinity;
    for (let percent = 0; percent <= 100; percent++) {
      const value = effectValue(effect, percent);
      assert(Number.isFinite(value) && value >= previous);
      assert(Math.abs(effectPercent(effect, value) - percent) < 1e-9);
      previous = value;
    }
    assert.equal(effectValue(effect, 0), effect.minimum);
    assert.equal(effectValue(effect, 100), effect.maximum);
    assert(Math.abs(effectValue(effect, 50 - 1e-8) - effect.midpoint) < 1e-6);
    assert(Math.abs(effectValue(effect, 50 + 1e-8) - effect.midpoint) < 1e-6);
  }
});

test("previous ranges migrate physical values instead of reusing percentages", () => {
  for (const effect of effects) {
    if (!effect.previous) continue;
    for (const percent of [0, 25, 50, 75, 100]) {
      const migrated = readPercent(effect, {
        getItem: (key) =>
          key === effect.previous?.storageKey ? String(percent) : null,
      });
      const expected =
        effect.previous.minimum +
        ((effect.previous.maximum - effect.previous.minimum) * percent) / 100;
      assert(Math.abs(effectValue(effect, migrated) - expected) < 1e-10);
      const preferred = readPercent(effect, {
        getItem: (key) => (key === effect.storageKey ? "80" : String(percent)),
      });
      assert.equal(preferred, 80);
    }
  }
});
