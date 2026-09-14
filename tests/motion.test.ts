import { test } from "node:test";
import assert from "node:assert/strict";
import { TiltTracker as Tracker } from "../src/engine/TiltTracker";
function calibrated() {
  const t = new Tracker();
  t.start();
  let result;
  for (let ms = 0; ms <= 1000; ms += 20) result = t.update([0, -9.81, 0], ms);
  assert(t.base);
  return t;
}
test("stable calibration establishes zero", () => {
  const t = calibrated();
  assert.equal(t.angle, 0);
});
test("held left/right tilts keep signed angles instead of recentering", () => {
  for (const deg of [-60, -30, 30, 60]) {
    const t = calibrated(),
      r = (deg * Math.PI) / 180;
    for (let ms = 1020; ms < 3020; ms += 20)
      t.update([9.81 * Math.sin(r), -9.81 * Math.cos(r), 0], ms);
    assert(Math.abs(t.angle - deg) < 0.01);
  }
});
test("invalid acceleration does not corrupt calibrated angle", () => {
  const t = calibrated();
  assert(t.update([0, 0, 0], 1100).invalid);
  assert.equal(t.angle, 0);
  assert(t.update([NaN, 0, 0], 1120).invalid);
});
test("unstable calibration waits for a stable interval", () => {
  const t = new Tracker();
  t.start();
  for (let ms = 0; ms < 1600; ms += 20)
    t.update(ms % 40 ? [3, -9.3, 0] : [-3, -9.3, 0], ms);
  assert.equal(t.base, null);
  assert(t.calibrating);
});
