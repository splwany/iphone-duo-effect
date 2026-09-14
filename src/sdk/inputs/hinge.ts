export interface HingeMapping {
  /** Sensor reading that should show the clear, flat image. */
  flatAngle?: number;
  /** Sensor reading that should show the maximum visual effect. */
  foldedAngle?: number;
  direction?: -1 | 1;
}

/** Maps any finite sensor range to signed effect progress; no sensor access. */
export function createHingeMapper({
  flatAngle = 180,
  foldedAngle = 0,
  direction = 1,
}: HingeMapping = {}): (angle: number) => number {
  if (
    !Number.isFinite(flatAngle) ||
    !Number.isFinite(foldedAngle) ||
    flatAngle === foldedAngle
  )
    throw new RangeError("Hinge endpoints must be finite and different");
  if (direction !== -1 && direction !== 1)
    throw new RangeError("Direction must be -1 or 1");
  return (angle) => {
    if (!Number.isFinite(angle))
      throw new TypeError("Hinge angle must be finite");
    return (
      direction *
      Math.max(0, Math.min(1, (angle - flatAngle) / (foldedAngle - flatAngle)))
    );
  };
}
