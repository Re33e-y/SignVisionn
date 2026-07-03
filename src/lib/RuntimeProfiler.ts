/**
 * Lightweight FPS profiler for loops that may tick intermittently.
 */
export class RuntimeProfiler {
  private lastSampleTime = performance.now();
  private framesSinceSample = 0;
  private fps = 0;

  tick(now = performance.now()) {
    this.framesSinceSample += 1;
    this.refresh(now);
  }

  getFPS(now = performance.now()): number {
    this.refresh(now);
    return this.fps;
  }

  private refresh(now: number) {
    if (now - this.lastSampleTime < 1000) {
      return;
    }

    this.fps =
      this.framesSinceSample === 0
        ? 0
        : (this.framesSinceSample * 1000) / (now - this.lastSampleTime);
    this.framesSinceSample = 0;
    this.lastSampleTime = now;
  }
}
