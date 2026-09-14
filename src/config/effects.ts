export const effects = [
  {
    id: "blur-strength",
    label: "模糊强度",
    outputId: "blur-value",
    note: "数值越高，倾斜时画面越模糊。",
    property: "blurStrength",
    storageKey: "fold-blur-strength-v2",
    legacyKey: "fold-blur-strength",
    minimum: 0.0,
    midpoint: 0.1,
    previous: null,
    maximum: 0.2,
  },
  {
    id: "horizontal-stretch",
    label: "横向拉伸",
    outputId: "stretch-value",
    note: "数值越高，倾斜时画面横向拉伸越明显。",
    property: "horizontalStretch",
    storageKey: "fold-horizontal-stretch-v3",
    legacyKey: "fold-horizontal-stretch",
    minimum: 0,
    midpoint: 0.9,
    previous: {
      storageKey: "fold-horizontal-stretch-v2",
      minimum: 0.8,
      maximum: 1,
    },
    maximum: 1,
  },
  {
    id: "far-shrink",
    label: "远端内缩",
    outputId: "shrink-value",
    note: "数值越高，画面远端向内收得越多。",
    property: "farShrink",
    storageKey: "fold-far-shrink-v2",
    legacyKey: "fold-far-shrink",
    minimum: 0.0,
    midpoint: 0.13,
    previous: null,
    maximum: 0.26,
  },
  {
    id: "blur-curve",
    label: "模糊加速",
    outputId: "blur-curve-value",
    note: "数值越高，模糊越集中在大角度时出现。",
    property: "blurCurve",
    storageKey: "fold-blur-curve-v1",
    legacyKey: null,
    minimum: 1.0,
    midpoint: 2.0,
    previous: null,
    maximum: 3.0,
  },
  {
    id: "scatter-focus",
    label: "散射集中度",
    outputId: "scatter-focus-value",
    note: "数值越高，模糊越集中；越低，扩散越均匀。",
    property: "scatterFocus",
    storageKey: "fold-scatter-focus-v2",
    legacyKey: null,
    minimum: 0,
    midpoint: 2,
    previous: { storageKey: "fold-scatter-focus-v1", minimum: 0, maximum: 4 },
    maximum: 24,
  },
  {
    id: "scatter-x",
    label: "横向散射",
    outputId: "scatter-x-value",
    note: "倾斜较大时，数值越高，左右扩散越远。",
    property: "scatterX",
    storageKey: "fold-scatter-x-v1",
    legacyKey: null,
    minimum: 0.0,
    midpoint: 2.0,
    previous: null,
    maximum: 4.0,
  },
  {
    id: "scatter-y",
    label: "纵向散射",
    outputId: "scatter-y-value",
    note: "倾斜较大时，数值越高，上下扩散越远。",
    property: "scatterY",
    storageKey: "fold-scatter-y-v1",
    legacyKey: null,
    minimum: 0.0,
    midpoint: 1.0,
    previous: null,
    maximum: 2.0,
  },
  {
    id: "grazing-range",
    label: "大角度扩散",
    outputId: "grazing-range-value",
    note: "数值越高，大幅倾斜时模糊扩散越远。",
    property: "grazingRange",
    storageKey: "fold-grazing-range-v1",
    legacyKey: null,
    minimum: 0.25,
    midpoint: 0.5,
    previous: null,
    maximum: 0.75,
  },
  {
    id: "edge-softness",
    label: "边缘柔化",
    outputId: "edge-softness-value",
    note: "倾斜时，低值边缘清晰，高值边缘更柔和。",
    property: "edgeSoftness",
    storageKey: "fold-edge-softness-v2",
    legacyKey: null,
    minimum: 0,
    midpoint: 1,
    previous: {
      storageKey: "fold-edge-softness-v1",
      minimum: 0.5,
      maximum: 1.5,
    },
    maximum: 12,
  },
  {
    id: "blur-blend",
    label: "细节融合",
    outputId: "blur-blend-value",
    note: "倾斜后观察文字：低值保留细节，高值融合更柔和。",
    property: "blurBlend",
    storageKey: "fold-blur-blend-v2",
    legacyKey: null,
    minimum: 0,
    midpoint: 0.7,
    previous: { storageKey: "fold-blur-blend-v1", minimum: 0.4, maximum: 1 },
    maximum: 4,
  },
  {
    id: "follow-smooth",
    label: "跟手平滑",
    outputId: "follow-smooth-value",
    note: "移动手机或滑杆时，低值跟手，高值缓慢过渡。",
    property: "followSmooth",
    storageKey: "fold-follow-smooth-v2",
    legacyKey: null,
    minimum: 10,
    midpoint: 35,
    previous: { storageKey: "fold-follow-smooth-v1", minimum: 10, maximum: 60 },
    maximum: 250,
  },
] as const;
export type Effect = (typeof effects)[number];
export type EffectProperty = Effect["property"];
/** Two continuous segments retain the original 50% while opening useful extremes. */
export function effectValue(effect: Effect, percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  if (p === 50) return effect.midpoint;
  return p < 50
    ? effect.minimum + ((effect.midpoint - effect.minimum) * p) / 50
    : effect.midpoint + ((effect.maximum - effect.midpoint) * (p - 50)) / 50;
}

export function effectPercent(effect: Effect, value: number): number {
  const percent =
    value <= effect.midpoint
      ? ((value - effect.minimum) / (effect.midpoint - effect.minimum)) * 50
      : 50 +
        ((value - effect.midpoint) / (effect.maximum - effect.midpoint)) * 50;
  return Math.max(0, Math.min(100, percent));
}

export function readPercent(
  effect: Effect,
  storage?: Pick<Storage, "getItem">,
): number {
  try {
    storage ??= localStorage;
    const saved = storage.getItem(effect.storageKey);
    if (saved !== null && Number.isFinite(Number(saved)))
      return Math.max(0, Math.min(100, Number(saved)));
    if (effect.previous) {
      const previous = storage.getItem(effect.previous.storageKey);
      if (previous !== null && Number.isFinite(Number(previous))) {
        const p = Math.max(0, Math.min(100, Number(previous)));
        const value =
          effect.previous.minimum +
          ((effect.previous.maximum - effect.previous.minimum) * p) / 100;
        return effectPercent(effect, value);
      }
    }
    const legacy = effect.legacyKey ? storage.getItem(effect.legacyKey) : null;
    if (legacy !== null && Number.isFinite(Number(legacy)))
      return effectPercent(effect, Number(legacy) / 100);
  } catch {}
  return 50;
}
