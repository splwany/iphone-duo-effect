import { TiltTracker } from "./TiltTracker";
import { angleToProgress } from "../progress";

export interface Acceleration {
  x: number | null;
  y: number | null;
  z: number | null;
}
export interface GravitySample {
  accelerationIncludingGravity: Acceleration | null;
  acceleration?: Acceleration | null;
}

/** Pure adapter: the host owns permission, event subscription and the clock. */
export class GravityInput {
  private tracker = new TiltTracker();

  calibrate() {
    this.tracker.start();
  }

  update(sample: GravitySample, time: number, orientationDegrees = 0) {
    if (!Number.isFinite(time) || !Number.isFinite(orientationDegrees))
      throw new TypeError("Gravity timestamp and orientation must be finite");
    const g = sample.accelerationIncludingGravity;
    if (!g || ![g.x, g.y, g.z].every(Number.isFinite)) return null;
    const a = sample.acceleration;
    const [x, y, z] = (["x", "y", "z"] as const).map(
      (axis) => g[axis]! - (a && Number.isFinite(a[axis]) ? a[axis]! : 0),
    );
    const orientation = (orientationDegrees * Math.PI) / 180;
    const result = this.tracker.update(
      [
        x * Math.cos(orientation) - y * Math.sin(orientation),
        x * Math.sin(orientation) + y * Math.cos(orientation),
        z,
      ],
      time,
    );
    return {
      ...result,
      progress: Number.isFinite(result.angle)
        ? angleToProgress(result.angle!)
        : undefined,
    };
  }
}
