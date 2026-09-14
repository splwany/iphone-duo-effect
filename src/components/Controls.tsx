import { effects } from "../config/effects";
import { EffectSlider } from "./EffectSlider";
export function Controls() {
  return (
    <section className="controls">
      <div className="caption">
        <h1>让截图轻轻翻过</h1>
        <span id="percent">0°</span>
      </div>
      <p className="intro">近处清晰 · 远处渐糊 · 倾斜越大越明显</p>
      <div className="actions">
        <label className="upload" htmlFor="file">
          <span>＋</span> 选择截图
        </label>
        <input id="file" type="file" accept="image/*" />
        <button id="motion" className="primary">
          开启体感
        </button>
      </div>
      <p id="status" role="status" aria-live="polite">
        拖动下方滑杆试试，或开启体感左右倾斜。
      </p>
      {effects.slice(0, 3).map((effect) => (
        <EffectSlider key={effect.id} effect={effect} />
      ))}
      <details id="advanced-controls">
        <summary>高级调节</summary>
        <p>默认值均为 50%，调整后自动保存。</p>
        {effects.slice(3).map((effect) => (
          <EffectSlider key={effect.id} effect={effect} />
        ))}
      </details>
      <button id="reset-effects" className="calibration">
        恢复默认效果
      </button>
      <button id="calibrate" className="calibration">
        校准归零
      </button>
      <p className="sensitivity-note">以当前握持姿势为起点，重新校准。</p>
      <div className="slider-label">
        <label htmlFor="progress">手动体验</label>
      </div>
      <input
        id="progress"
        type="range"
        min="0"
        max="100"
        defaultValue="50"
        aria-label="左右倾斜程度"
      />
      <div className="range-ends">
        <span>左倾</span>
        <span>居中清晰</span>
        <span>右倾</span>
      </div>
      <details>
        <summary>使用说明</summary>
        <p>
          开启体感后，竖屏握稳约 1 秒完成校准，再左右倾斜。拖动滑杆会暂停体感。
        </p>
        <p>进入沉浸体验后，轻点画面可显示校准和退出按钮。</p>
        <p>
          在 iPhone Safari 中，点“分享 → 添加到主屏幕”，下次即可从主屏幕打开。
        </p>
        <p>截图仅在本机处理，刷新后需重新选择。建议使用 PNG 或 JPEG 图片。</p>
        <p>效果仅在此页面内显示，不会改变系统桌面。</p>
      </details>
      <details id="layout-details">
        <summary>屏幕适配信息</summary>
        <pre id="layout-info"></pre>
      </details>
      <footer>
        <span>截图留在本机</span>
        <span>为单手体验而做</span>
      </footer>
    </section>
  );
}
