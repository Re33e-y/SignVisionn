/**
 * OneEuroFilter: A speed-based low-pass filter for noisy signals.
 * Based on: http://www.lifl.fr/~casiez/1euro/
 */

export class LowPassFilter {
  private y: number | null = null;
  private alpha: number = 0;

  constructor(alpha: number) {
    this.alpha = alpha;
  }

  filter(value: number): number {
    if (this.y === null) {
      this.y = value;
    } else {
      this.y = this.alpha * value + (1 - this.alpha) * this.y;
    }
    return this.y;
  }

  setAlpha(alpha: number) {
    this.alpha = alpha;
  }
}

export class OneEuroFilter {
  private freq: number;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(freq: number, minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    
    this.xFilter = new LowPassFilter(this.alpha(minCutoff));
    this.dxFilter = new LowPassFilter(this.alpha(dCutoff));
  }

  private alpha(cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / this.freq;
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime !== null && timestamp > this.lastTime) {
      const te = (timestamp - this.lastTime) / 1000;
      if (te > 0) this.freq = 1.0 / te;
    }
    this.lastTime = timestamp;

    const dx = this.dxFilter.filter((value - (this.xFilter.filter(value) || value)) * this.freq);
    const cutoff = this.minCutoff + this.beta * Math.abs(dx);
    
    this.xFilter.setAlpha(this.alpha(cutoff));
    return this.xFilter.filter(value);
  }
}

export class HandSmoothingFilter {
  private filters: OneEuroFilter[] = [];

  constructor(numPoints = 21, freq = 30) {
    // 2D landmarks (x, y) = 42 filters
    for (let i = 0; i < numPoints * 2; i++) {
        // Optimized for hand stability: minCutoff 1.0, beta 0.007
      this.filters.push(new OneEuroFilter(freq, 1.0, 0.007, 1.0));
    }
  }

  filter(landmarks: {x: number, y: number}[], timestamp: number) {
    return landmarks.map((p, i) => ({
      x: this.filters[i * 2].filter(p.x, timestamp),
      y: this.filters[i * 2 + 1].filter(p.y, timestamp)
    }));
  }
}
