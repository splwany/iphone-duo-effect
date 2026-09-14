import { defaultParameters, type FoldEffect } from "../sdk";
import {
  effects,
  effectPercent,
  effectValue,
  readPercent,
} from "../config/effects";

/** Demo-only labels, slider percentages and persistent preferences. */
export function mountEffectControls(
  effectPlayer: FoldEffect,
  signal: AbortSignal,
  status: (message: string) => void,
) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const effectResets: Array<() => void> = [];
  for (const effect of effects) {
    const input = $<HTMLInputElement>(effect.id);
    const apply = (percent: number) => {
      const value =
        effect.property === "blurStrength" ? percent : Math.round(percent);
      effectPlayer.setParameters({
        [effect.property]: effectValue(effect, percent),
      });
      input.value = String(value);
      $(effect.outputId).textContent = `${value}%`;
    };
    apply(readPercent(effect));
    input.addEventListener(
      "input",
      () => {
        apply(Number(input.value));
        try {
          localStorage.setItem(effect.storageKey, input.value);
        } catch {}
      },
      { signal },
    );
    effectResets.push(() => {
      const percent = effectPercent(effect, defaultParameters[effect.property]);
      apply(percent);
      try {
        for (const key of [
          effect.storageKey,
          effect.previous?.storageKey,
          effect.legacyKey,
        ]) {
          if (key) localStorage.removeItem(key);
        }
      } catch {}
    });
  }
  $("reset-effects").addEventListener(
    "click",
    () => {
      effectResets.forEach((reset) => reset());
      status("已恢复默认效果。");
    },
    { signal },
  );
}
