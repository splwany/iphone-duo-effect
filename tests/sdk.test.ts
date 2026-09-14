import { test } from "node:test";
import assert from "node:assert/strict";
import {
  angleToProgress,
  createHingeMapper,
  defaultParameters,
  GravityInput,
  resolveParameters,
} from "../src/sdk";
import { ProgressState } from "../src/sdk/progress";

test("public entry can be imported without a browser; inputs have explicit ranges", () => {
  assert.deepEqual(
    [-180, -90, 0, 45, 90, 180].map(angleToProgress),
    [-1, -1, 0, 0.5, 1, 1],
  );
  assert.throws(() => angleToProgress(NaN), TypeError);
  const hinge = createHingeMapper();
  assert.deepEqual([200, 180, 90, 0, -20].map(hinge), [0, 0, 0.5, 1, 1]);
  const reverse = createHingeMapper({
    flatAngle: 0,
    foldedAngle: 120,
    direction: -1,
  });
  assert.equal(reverse(60), -0.5);
  assert.throws(
    () => createHingeMapper({ flatAngle: 0, foldedAngle: 0 }),
    RangeError,
  );
  assert.throws(() => hinge(Infinity), TypeError);
});

test("configuration patches are validated atomically, bounded and independent", () => {
  const a = resolveParameters({
    blurStrength: 0.15,
    edgeSoftness: 999,
    followSmooth: -100,
  });
  assert.equal(a.blurStrength, 0.15);
  assert.equal(a.edgeSoftness, 12);
  assert.equal(a.followSmooth, 10);
  assert.equal(defaultParameters.blurStrength, 0.1);
  assert.throws(
    () => resolveParameters({ blurStrength: 0.15, scatterX: NaN }, a),
    TypeError,
  );
  assert.throws(
    () => resolveParameters(JSON.parse('{"blurStrenght": 0.1}')),
    TypeError,
  );
  assert.throws(
    () => resolveParameters(JSON.parse('{"blurStrength": "0.1"}')),
    TypeError,
  );
  assert.equal(a.scatterX, 2);
  assert.equal(resolveParameters({}).blurStrength, 0.1);
});

test("smoothing preserves the original response and caps long frame gaps", () => {
  const motion = new ProgressState();
  motion.advance(100, 35);
  motion.set(1);
  assert.equal(motion.advance(116, 35), 1 - Math.exp(-16 / 35));
  motion.set(-1, true);
  assert.equal(motion.current, -1);
  motion.set(1);
  assert.equal(motion.advance(10000, 35), -1 + 2 * (1 - Math.exp(-64 / 35)));
  motion.resetClock();
  const value = motion.current;
  assert.equal(motion.advance(20000, 35), value);
});

test("gravity adapter emits the same signed progress after calibration and rotation", () => {
  for (const orientation of [0, 90]) {
    const input = new GravityInput();
    const sample = (angle: number) => {
      const radians = ((angle - orientation) * Math.PI) / 180;
      return {
        accelerationIncludingGravity: {
          x: 9.81 * Math.sin(radians) + 1,
          y: -9.81 * Math.cos(radians),
          z: 0,
        },
        acceleration: { x: 1, y: 0, z: 0 },
      };
    };
    input.calibrate();
    for (let time = 0; time <= 1000; time += 20)
      input.update(sample(0), time, orientation);
    let result;
    for (let time = 1020; time <= 3000; time += 20)
      result = input.update(sample(45), time, orientation);
    assert(Math.abs(result!.progress! - 0.5) < 1e-6);
    assert.equal(
      input.update({ accelerationIncludingGravity: null }, 3020),
      null,
    );
  }
});
