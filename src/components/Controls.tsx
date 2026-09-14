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
          <span>＋</span> 选择自己的截图
        </label>
        <input id="file" type="file" accept="image/*" />
        <button id="motion" className="primary">
          开启体感
        </button>
      </div>
      <p id="status" role="status" aria-live="polite">
        先用示例试试，也可以选择相册中的截图。
      </p>
      {effects.slice(0, 3).map((effect) => (
        <EffectSlider key={effect.id} effect={effect} />
      ))}
      <details id="advanced-controls">
        <summary>高级调节</summary>
        <p>每项 50% 都对应当前默认效果，设置自动保存。</p>
        {effects.slice(3).map((effect) => (
          <EffectSlider key={effect.id} effect={effect} />
        ))}
      </details>
      <button id="reset-effects" className="calibration">
        所有效果恢复 50%
      </button>
      <button id="calibrate" className="calibration">
        校准归零
      </button>
      <p className="sensitivity-note">角度一一对应：0° 清晰 · 随倾斜渐糊</p>
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
        <summary>全屏打开与使用说明</summary>
        <p>
          在 iPhone Safari
          中，点“分享”→“添加到主屏幕”，再从主屏幕打开。进入沉浸体验后，轻点画面可显示校准和退出按钮。
        </p>
        <p>
          竖屏握持，以校准姿势为
          0°，左右倾斜角度直接对应画面效果；模糊程度随倾斜角度与模糊强度变化。开启体感后握稳约
          1
          秒，将当前姿势设为清晰的基准面；手动拖动滑杆会暂停体感。前后倾斜不会用于控制动画。
        </p>
        <p>
          图片仅在本机处理，不会发送到服务器。刷新后需重新选择。建议使用 PNG 或
          JPEG 截图。
        </p>
        <p>这是按离基准面距离变化的渐变模糊过渡，不会改变系统桌面。</p>
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
