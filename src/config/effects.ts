export const effects = [
  {
    id: "blur-strength",
    label: "模糊强度",
    outputId: "blur-value",
    note: "围绕你选好的效果精调：50% = 旧版 10%；范围对应旧版 0%–20%。",
    property: "blurStrength",
    storageKey: "fold-blur-strength-v2",
    legacyKey: "fold-blur-strength",
    minimum: 0,
    maximum: 0.2,
  },
  {
    id: "horizontal-stretch",
    label: "横向拉伸",
    outputId: "stretch-value",
    note: "围绕你选好的效果微调：50% = 旧版 90%；两端对应旧版 80%–100%。",
    property: "horizontalStretch",
    storageKey: "fold-horizontal-stretch-v2",
    legacyKey: "fold-horizontal-stretch",
    minimum: 0.8,
    maximum: 1.0,
  },
  {
    id: "far-shrink",
    label: "远端内缩",
    outputId: "shrink-value",
    note: "围绕你选好的效果微调：50% = 旧版 13%；两端对应旧版 0%–26%。",
    property: "farShrink",
    storageKey: "fold-far-shrink-v2",
    legacyKey: "fold-far-shrink",
    minimum: 0.0,
    maximum: 0.26,
  },
  {
    id: "blur-curve",
    label: "模糊加速",
    outputId: "blur-curve-value",
    note: "越高，前期越清晰，模糊越集中在后期。",
    property: "blurCurve",
    storageKey: "fold-blur-curve-v1",
    legacyKey: null,
    minimum: 1.0,
    maximum: 3.0,
  },
  {
    id: "scatter-focus",
    label: "散射集中度",
    outputId: "scatter-focus-value",
    note: "越高，散射越集中在中心；越低，向周围扩散越均匀。",
    property: "scatterFocus",
    storageKey: "fold-scatter-focus-v1",
    legacyKey: null,
    minimum: 0.0,
    maximum: 4.0,
  },
  {
    id: "scatter-x",
    label: "横向散射",
    outputId: "scatter-x-value",
    note: "控制倾斜后模糊向左右扩展的程度。",
    property: "scatterX",
    storageKey: "fold-scatter-x-v1",
    legacyKey: null,
    minimum: 0.0,
    maximum: 4.0,
  },
  {
    id: "scatter-y",
    label: "纵向散射",
    outputId: "scatter-y-value",
    note: "控制倾斜后模糊向上下扩展的程度。",
    property: "scatterY",
    storageKey: "fold-scatter-y-v1",
    legacyKey: null,
    minimum: 0.0,
    maximum: 2.0,
  },
  {
    id: "grazing-range",
    label: "大角度扩散",
    outputId: "grazing-range-value",
    note: "越高，接近侧立时允许扩散得越远。",
    property: "grazingRange",
    storageKey: "fold-grazing-range-v1",
    legacyKey: null,
    minimum: 0.25,
    maximum: 0.75,
  },
  {
    id: "edge-softness",
    label: "边缘柔化",
    outputId: "edge-softness-value",
    note: "调整轮廓的柔和程度；边缘仍会跟随内容渐糊。",
    property: "edgeSoftness",
    storageKey: "fold-edge-softness-v1",
    legacyKey: null,
    minimum: 0.5,
    maximum: 1.5,
  },
  {
    id: "blur-blend",
    label: "细节融合",
    outputId: "blur-blend-value",
    note: "越高，模糊细节融合得越充分；越低，保留更多纹理。",
    property: "blurBlend",
    storageKey: "fold-blur-blend-v1",
    legacyKey: null,
    minimum: 0.4,
    maximum: 1.0,
  },
  {
    id: "follow-smooth",
    label: "跟手平滑",
    outputId: "follow-smooth-value",
    note: "越低响应越快；越高变化越柔和。",
    property: "followSmooth",
    storageKey: "fold-follow-smooth-v1",
    legacyKey: null,
    minimum: 10.0,
    maximum: 60.0,
  },
] as const;
export type Effect = (typeof effects)[number];
export type EffectProperty = Effect["property"];
export function effectValue(effect: Effect, percent: number): number {
  return effect.property === "blurStrength"
    ? percent / 500
    : effect.minimum + ((effect.maximum - effect.minimum) * percent) / 100;
}
export function readPercent(
  effect: Effect,
  storage?: Pick<Storage, "getItem">,
): number {
  let value = 50;
  try {
    storage ??= localStorage;
    const saved = storage.getItem(effect.storageKey);
    const legacy = effect.legacyKey ? storage.getItem(effect.legacyKey) : null;
    if (saved !== null && Number.isFinite(Number(saved))) value = Number(saved);
    else if (legacy !== null && Number.isFinite(Number(legacy)))
      value =
        effect.property === "blurStrength"
          ? Number(legacy) * 5
          : ((Number(legacy) / 100 - effect.minimum) /
              (effect.maximum - effect.minimum)) *
            100;
  } catch {}
  return Math.max(0, Math.min(100, value));
}
