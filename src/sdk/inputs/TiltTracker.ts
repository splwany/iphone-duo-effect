// A calibrated gravity frame avoids the singularity of atan2(x,y) near flat.
export class TiltTracker {
  base: number[] | null;
  side: number[] | null;
  samples: number[][];
  since: number;
  calibrating: boolean;
  filtered: number[] | null;
  time: number;
  angle: number;
  constructor() {
    this.base = null;
    this.side = null;
    this.samples = [];
    this.since = 0;
    this.calibrating = false;
    this.filtered = null;
    this.time = 0;
    this.angle = 0;
  }
  static dot(a: number[], b: number[]) {
    return a.reduce((s, v, i) => s + v * b[i], 0);
  }
  static unit(a: number[]): number[] | null {
    const n = Math.hypot(...a);
    return n > 0.001 ? a.map((v) => v / n) : null;
  }
  start() {
    this.samples = [];
    this.since = 0;
    this.calibrating = true;
    this.filtered = null;
    this.time = 0;
  }
  update(
    vector: number[],
    time: number,
  ): {
    invalid?: boolean;
    calibrating?: boolean;
    edge?: boolean;
    calibrated?: boolean;
    angle?: number;
  } {
    const magnitude = Math.hypot(...vector);
    if (!Number.isFinite(magnitude) || magnitude < 6 || magnitude > 14)
      return { invalid: true };
    const raw = TiltTracker.unit(vector)!; // Magnitude was validated above.
    const dt = this.time ? Math.max(1, Math.min(100, time - this.time)) : 16;
    this.time = time;
    const blend = 1 - Math.exp(-dt / 45);
    this.filtered = this.filtered
      ? TiltTracker.unit(
          raw.map(
            (v, i) => this.filtered![i] + (v - this.filtered![i]) * blend,
          ),
        )
      : raw;
    if (this.calibrating) {
      if (
        this.samples.length &&
        TiltTracker.dot(raw, this.samples[0]) < Math.cos((2.5 * Math.PI) / 180)
      ) {
        this.samples = [];
        this.since = 0;
      }
      if (!this.samples.length) this.since = time;
      this.samples.push(raw);
      if (time - this.since < 800 || this.samples.length < 12)
        return { calibrating: true };
      const b = TiltTracker.unit(
        [0, 1, 2].map((i) => this.samples.reduce((s, v) => s + v[i], 0)),
      )!; // Stable samples are aligned and cannot sum to zero.
      // Reject a phone resting on its left/right edge, where gravity cannot
      // establish a reliable sideways rotation axis.
      if (Math.abs(b[0]) > 0.9) {
        this.samples = [];
        return { calibrating: true, edge: true };
      }
      this.base = b;
      this.side = TiltTracker.unit([1, 0, 0].map((v, i) => v - b[0] * b[i]));
      this.filtered = b;
      this.calibrating = false;
      this.angle = 0;
      return { angle: 0, calibrated: true };
    }
    if (!this.base) return {};
    const x = TiltTracker.dot(this.filtered!, this.side!),
      y = TiltTracker.dot(this.filtered!, this.base);
    if (Math.hypot(x, y) < 0.25) return { invalid: true };
    const angle = (Math.atan2(x, y) * 180) / Math.PI;
    // Keep the calibrated zero fixed. No auto-recentering or gyro integration.
    this.angle = Math.max(-90, Math.min(90, angle));
    return { angle: this.angle };
  }
}
