/** Signed effect progress: -1 = left 90°, 0 = flat, 1 = right 90°. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError("Progress must be finite");
  return Math.max(-1, Math.min(1, value));
}

export function angleToProgress(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new TypeError("Angle must be finite");
  return clampProgress(degrees / 90);
}

/** Pure motion state; input sources and the rendering clock are independent. */
export class ProgressState {
  current = 0;
  target = 0;
  private previousTime: number | undefined;

  set(value: number, immediate = false) {
    this.target = clampProgress(value);
    if (immediate) this.current = this.target;
  }

  advance(time: number, smoothMs: number): number {
    const dt = Math.max(0, Math.min(64, time - (this.previousTime ?? time)));
    this.previousTime = time;
    this.current +=
      (this.target - this.current) * (1 - Math.exp(-dt / smoothMs));
    if (Math.abs(this.target - this.current) < 0.0001)
      this.current = this.target;
    return this.current;
  }

  resetClock() {
    this.previousTime = undefined;
  }
}
