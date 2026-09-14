export function Preview() {
  return (
    <section id="stage" aria-label="倾斜翻页效果预览">
      <div className="ambient"></div>
      <div id="fold">
        <div className="surface"></div>
      </div>
      <div className="stage-note">左右倾斜，让画面流动</div>
      <button id="calibrate-full" className="full-calibrate">
        校准归零
      </button>
      <button id="exit" aria-label="退出沉浸体验">
        退出
      </button>
    </section>
  );
}
