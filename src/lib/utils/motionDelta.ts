export class MotionDeltaFilter {
  private lastFrame: Uint8ClampedArray | null = null;
  private width: number;
  private height: number;
  private threshold = 2.0;

  constructor(width = 80, height = 60) {
    this.width = width;
    this.height = height;
  }

  /**
   * Returns true if there is significant motion (> thresh%).
   */
  hasMotion(currentFrame: Uint8ClampedArray): boolean {
    if (!this.lastFrame) {
      this.lastFrame = new Uint8ClampedArray(currentFrame);
      return true;
    }

    let diff = 0;
    const len = currentFrame.length;
    
    // Efficient sampling for motion delta (skip by step)
    const step = 4; // Check every 4th pixel for speed
    for (let i = 0; i < len; i += step) {
      diff += Math.abs(currentFrame[i] - this.lastFrame[i]);
    }

    const avgDiff = diff / (len / 4);
    const hasMotion = avgDiff > this.threshold;

    this.lastFrame.set(currentFrame);
    return hasMotion;
  }

  setThreshold(thresh: number) {
    this.threshold = thresh;
  }
}
