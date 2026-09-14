export { FoldEffect, createFoldEffect } from "./FoldEffect";
export type {
  FoldEffectOptions,
  FoldEffectState,
  ProgressOptions,
  InputSource,
} from "./FoldEffect";
export {
  defaultParameters,
  parameterRanges,
  resolveParameters,
} from "./parameters";
export type { EffectParameters, EffectParameter } from "./parameters";
export { angleToProgress } from "./progress";
export { createHingeMapper } from "./inputs/hinge";
export type { HingeMapping } from "./inputs/hinge";
export { GravityInput } from "./inputs/gravity";
export type { GravitySample, Acceleration } from "./inputs/gravity";
