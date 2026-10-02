/**
 * Runtime depth / performance manager.
 *
 * A single source of truth for how much spatial 3D the app is allowed to
 * render right now. It combines:
 *
 *  - static device hints (cores, memory, data saver, pointer type, width)
 *  - the user's motion preference (OS `prefers-reduced-motion` + in-app toggle)
 *  - a live frame-rate probe that downgrades the level when the device can't
 *    keep the compositor at a comfortable frame budget
 *
 * Components never read `navigator` directly — they subscribe through
 * `useDepthCapability()` so a single downgrade instantly flattens every
 * spatial surface in the product.
 */

export type DepthLevel = "off" | "lite" | "full";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

const ORDER: DepthLevel[] = ["off", "lite", "full"];

/** Frame budget below which we step the level down. */
const FULL_MIN_FPS = 42;
const LITE_MIN_FPS = 24;
/** Length of one probe window, in ms. */
const SAMPLE_MS = 1600;
/** How many consecutive bad windows before we downgrade. */
const BAD_WINDOWS = 2;
/** How many consecutive good windows before we upgrade the ceiling back. */
const GOOD_WINDOWS = 4;

export function detectDeviceLevel(): DepthLevel {
  if (typeof window === "undefined") return "lite";
  const nav = navigator as NavigatorWithHints;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const narrow = window.innerWidth < 768;
  const lowCores = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  const saveData = nav.connection?.saveData === true;

  if (saveData) return "off";
  if (coarse || narrow || lowCores || lowMemory) return "lite";
  return "full";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function resolveLevel(input: {
  device: DepthLevel;
  reduced: boolean;
  /** Performance ceiling imposed by the frame-rate probe. */
  ceiling: DepthLevel;
  /** Explicit user/QA override; wins over everything except reduced motion. */
  override?: DepthLevel | null;
}): DepthLevel {
  if (input.reduced) return "off";
  const base = input.override ?? input.device;
  return ORDER.indexOf(base) <= ORDER.indexOf(input.ceiling) ? base : input.ceiling;
}

type Listener = (level: DepthLevel) => void;

class DepthManager {
  private device: DepthLevel = "lite";
  private reduced = false;
  private ceiling: DepthLevel = "full";
  private override: DepthLevel | null = null;
  private level: DepthLevel = "lite";
  private listeners = new Set<Listener>();
  private started = false;
  private rafId: number | null = null;
  private badWindows = 0;
  private goodWindows = 0;

  getLevel(): DepthLevel {
    return this.level;
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    this.start();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.stop();
    };
  };

  /** Force a level (admin/QA). Pass `null` to hand control back to detection. */
  setOverride(level: DepthLevel | null) {
    this.override = level;
    this.recompute();
  }

  /** Called by the motion-preference provider when the in-app toggle changes. */
  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    this.recompute();
  }

  /** Re-run device detection (resize, orientation change, network change). */
  refreshDevice() {
    this.device = detectDeviceLevel();
    this.recompute();
  }

  private recompute() {
    const next = resolveLevel({
      device: this.device,
      reduced: this.reduced,
      ceiling: this.ceiling,
      override: this.override,
    });
    if (typeof document !== "undefined") {
      document.documentElement.dataset.depth = next;
    }
    if (next === this.level) return;
    this.level = next;
    this.listeners.forEach((fn) => fn(next));
  }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.device = detectDeviceLevel();
    this.reduced = this.reduced || prefersReducedMotion();

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", this.onReducedChange);
    window.addEventListener("resize", this.onResize, { passive: true });

    this.recompute();
    this.probe();
  }

  private stop() {
    this.started = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (typeof window === "undefined") return;
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.removeEventListener?.("change", this.onReducedChange);
    window.removeEventListener("resize", this.onResize);
  }

  private onReducedChange = (e: MediaQueryListEvent) => {
    this.reduced = e.matches;
    this.recompute();
  };

  private onResize = () => this.refreshDevice();

  /**
   * Rolling frame-rate probe. Only runs while depth is actually being rendered,
   * and stops permanently once the ceiling bottoms out at `off`.
   */
  private probe() {
    if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") return;
    let frames = 0;
    let windowStart = performance.now();

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= SAMPLE_MS) {
        const fps = (frames * 1000) / elapsed;
        this.consumeFps(fps);
        frames = 0;
        windowStart = now;
      }
      if (this.started) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private consumeFps(fps: number) {
    const floor = this.ceiling === "full" ? FULL_MIN_FPS : LITE_MIN_FPS;
    if (fps >= floor) {
      this.badWindows = 0;
      this.goodWindows += 1;
      // Recover: upgrade the ceiling after sustained good frame rate so a
      // temporary dip during page load doesn't permanently disable all spatial
      // effects for the rest of the session.
      if (this.goodWindows >= GOOD_WINDOWS && this.ceiling !== "full") {
        this.goodWindows = 0;
        this.ceiling = this.ceiling === "off" ? "lite" : "full";
        this.recompute();
      }
      return;
    }
    this.goodWindows = 0;
    this.badWindows += 1;
    if (this.badWindows < BAD_WINDOWS) return;
    this.badWindows = 0;
    this.ceiling = this.ceiling === "full" ? "lite" : "off";
    this.recompute();
  }

  /** Test seam. */
  _reset() {
    this.stop();
    this.device = "lite";
    this.reduced = false;
    this.ceiling = "full";
    this.override = null;
    this.level = "lite";
    this.badWindows = 0;
    this.goodWindows = 0;
    this.listeners.clear();
  }
}

export const depthManager = new DepthManager();
