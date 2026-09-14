import { DepthRenderer } from "./rendering/DepthRenderer";
import { rasterizeImage } from "./image";
import { resolveParameters, type EffectParameters } from "./parameters";
import { angleToProgress, ProgressState } from "./progress";

export interface FoldEffectState {
  readonly progress: number;
  readonly targetProgress: number;
  readonly angle: number;
}
export interface FoldEffectOptions {
  parameters?: Partial<EffectParameters>;
  progress?: number;
  /** Defaults to true. Use render(time) when the host owns the frame loop. */
  autoStart?: boolean;
}
export interface ProgressOptions {
  immediate?: boolean;
}
export type InputSource = (
  setProgress: (progress: number) => void,
) => () => void;

/** Framework-independent instance. Owns only its canvas, clock and input subscription. */
export class FoldEffect {
  private renderer: DepthRenderer;
  private motion = new ProgressState();
  private listeners = new Set<(state: FoldEffectState) => void>();
  private observer: ResizeObserver;
  private frame: number | undefined;
  private disposed = false;
  private disconnectInput?: () => void;
  private initialParameters: EffectParameters;

  constructor(host: HTMLElement, options: FoldEffectOptions = {}) {
    this.initialParameters = resolveParameters(options.parameters ?? {});
    this.motion.set(options.progress ?? 0, true);
    this.renderer = new DepthRenderer(host);
    this.renderer.parameters = { ...this.initialParameters };
    this.observer = new ResizeObserver(() =>
      this.renderer.draw(this.motion.current),
    );
    this.observer.observe(host);
    if (options.autoStart !== false) this.start();
  }

  get supported() {
    return this.renderer.gl !== null;
  }
  get state(): FoldEffectState {
    return Object.freeze({
      progress: this.motion.current,
      targetProgress: this.motion.target,
      angle: this.motion.current * 90,
    });
  }
  get parameters(): Readonly<EffectParameters> {
    return Object.freeze({ ...this.renderer.parameters });
  }

  setProgress(progress: number, { immediate = false }: ProgressOptions = {}) {
    this.assertAlive();
    this.motion.set(progress, immediate);
    if (immediate) this.renderCurrent();
  }
  setAngle(degrees: number, options?: ProgressOptions) {
    this.setProgress(angleToProgress(degrees), options);
  }
  setParameters(parameters: Partial<EffectParameters>) {
    this.assertAlive();
    this.renderer.parameters = resolveParameters(
      parameters,
      this.renderer.parameters,
    );
    this.renderer.draw(this.motion.current);
  }
  /** Restore this instance's configured defaults, including constructor overrides. */
  resetParameters() {
    this.setParameters(this.initialParameters);
  }

  setImage(image: HTMLImageElement | HTMLCanvasElement) {
    this.assertAlive();
    const canvas =
      image instanceof HTMLImageElement ? rasterizeImage(image) : image;
    if (canvas.width < 1 || canvas.height < 1)
      throw new RangeError("Image must have positive dimensions");
    this.renderer.setImage(canvas);
  }
  subscribe(listener: (state: FoldEffectState) => void): () => void {
    this.assertAlive();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Replaces the previous input subscription. Late events from old inputs are ignored. */
  connectInput(source: InputSource): () => void {
    this.assertAlive();
    this.disconnectInput?.();
    let active = true;
    let cleanup: (() => void) | undefined;
    const disconnect = () => {
      if (!active) return;
      active = false;
      try {
        cleanup?.();
      } finally {
        if (this.disconnectInput === disconnect)
          this.disconnectInput = undefined;
      }
    };
    this.disconnectInput = disconnect;
    try {
      cleanup = source((progress) => {
        if (active && !this.disposed) this.setProgress(progress);
      });
    } catch (error) {
      disconnect();
      throw error;
    }
    return disconnect;
  }
  start() {
    this.assertAlive();
    if (this.frame !== undefined) return;
    this.motion.resetClock();
    const tick = (time: number) => {
      this.frame = requestAnimationFrame(tick);
      this.render(time);
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.motion.resetClock();
  }
  /** Advance smoothing and draw. Time is a monotonic timestamp in milliseconds. */
  render(time: number) {
    this.assertAlive();
    if (!Number.isFinite(time))
      throw new TypeError("Frame time must be finite");
    this.motion.advance(time, this.renderer.parameters.followSmooth);
    this.renderCurrent();
  }
  resize() {
    this.assertAlive();
    this.renderer.draw(this.motion.current);
  }
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    try {
      this.disconnectInput?.();
    } finally {
      this.observer.disconnect();
      this.listeners.clear();
      this.renderer.dispose();
    }
  }
  private renderCurrent() {
    this.renderer.draw(this.motion.current);
    const state = this.state;
    this.listeners.forEach((listener) => listener(state));
  }
  private assertAlive() {
    if (this.disposed) throw new Error("FoldEffect has been disposed");
  }
}

export function createFoldEffect(
  host: HTMLElement,
  options?: FoldEffectOptions,
) {
  return new FoldEffect(host, options);
}
