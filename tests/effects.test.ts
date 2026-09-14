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
