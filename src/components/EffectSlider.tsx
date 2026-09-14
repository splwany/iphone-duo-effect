import type { Effect } from "../config/effects";
export function EffectSlider({ effect }: { effect: Effect }) {
  return (
    <>
      <div className="slider-label">
        <label htmlFor={effect.id}>{effect.label}</label>
        <output id={effect.outputId} htmlFor={effect.id}>
          50%
        </output>
      </div>
      <input
        id={effect.id}
        type="range"
        min="0"
        max="100"
        step="1"
        defaultValue="50"
      />
      <p className="sensitivity-note">{effect.note}</p>
    </>
  );
}
