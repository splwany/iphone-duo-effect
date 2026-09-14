import defaults from "./defaults.json";

/** Renderer units, not the demonstration page's 0–100 slider percentages. */
export const parameterRanges = {
  blurStrength: {
    midpoint: 0.1,
    minimum: 0,
    maximum: 0.2,
  },
  horizontalStretch: {
    midpoint: 0.9,
    minimum: 0,
    maximum: 1,
  },
  farShrink: {
    midpoint: 0.13,
    minimum: 0,
    maximum: 0.26,
  },
  blurCurve: {
    midpoint: 2,
    minimum: 1,
    maximum: 3,
  },
  scatterFocus: {
    midpoint: 2,
    minimum: 0,
    maximum: 24,
  },
  scatterX: {
    midpoint: 2,
    minimum: 0,
    maximum: 4,
  },
  scatterY: {
    midpoint: 1,
    minimum: 0,
    maximum: 2,
  },
  grazingRange: {
    midpoint: 0.5,
    minimum: 0.25,
    maximum: 0.75,
  },
  edgeSoftness: {
    midpoint: 1,
    minimum: 0,
    maximum: 12,
  },
  blurBlend: {
    midpoint: 0.7,
    minimum: 0,
    maximum: 4,
  },
  followSmooth: {
    midpoint: 35,
    minimum: 10,
    maximum: 250,
  },
} as const;
export type EffectParameter = keyof typeof parameterRanges;
export type EffectParameters = Record<EffectParameter, number>;

/** Reject malformed config atomically; clamp finite numbers to supported ranges. */
export function resolveParameters(
  patch: Partial<EffectParameters>,
  base: Readonly<EffectParameters> = defaults,
): EffectParameters {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new TypeError("Effect parameters must be an object");
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(parameterRanges, key))
      throw new TypeError("Unknown effect parameter: " + key);
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(key + " must be finite");
    const property = key as EffectParameter;
    const range = parameterRanges[property];
    next[property] = Math.max(range.minimum, Math.min(range.maximum, value));
  }
  return next;
}
export const defaultParameters: Readonly<EffectParameters> = Object.freeze(
  resolveParameters(defaults),
);
