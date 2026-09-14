export const effects = [
  {
    id: "blur-strength",
    label: "模糊强度",
    outputId: "blur-value",
    note: "数值越高，倾斜时画面越模糊。",
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
    note: "数值越高，倾斜时画面横向拉伸越明显。",
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
    note: "数值越高，画面远端向内收得越多。",
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
    note: "数值越高，模糊越集中在大角度时出现。",
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
    note: "数值越高，模糊越集中；越低，扩散越均匀。",
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
    note: "数值越高，倾斜时模糊向左右扩散越远。",
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
    note: "数值越高，倾斜时模糊向上下扩散越远。",
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
    note: "数值越高，大幅倾斜时模糊扩散越远。",
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
    note: "数值越高，画面边缘越柔和。",
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
    note: "数值越高，模糊越细腻；越低，保留更多纹理。",
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
    note: "数值越低，响应越快；越高，过渡越平滑。",
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
