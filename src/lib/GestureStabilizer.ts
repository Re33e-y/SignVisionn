/**
 * Prevents flickering by requiring a gesture to be consistently recognized 
 * across a sliding window before emitting it. Uses a cooldown to avoid double triggers.
 */
export class GestureStabilizer {
  private windowSize: number;
  private history: string[] = [];
  private lastEmitted: string | null = null;
  private cooldownMs: number;
  private lastEmitTime = 0;

  constructor(windowSize = 4, cooldownMs = 750) {
    this.windowSize = windowSize;
    this.cooldownMs = cooldownMs;
  }

  process(rawGesture: string): string | null {
    this.history.push(rawGesture);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    const now = performance.now();
    if (now - this.lastEmitTime < this.cooldownMs) {
      return this.lastEmitted; // Keep returning the stabilized gesture during cooldown
    }

    // Hysteresis: require X occurrences in window to switch
    const counts: Record<string, number> = {};
    for (const g of this.history) {
      counts[g] = (counts[g] || 0) + 1;
    }

    // Find majority
    let maxCount = 0;
    let majorityGesture = 'None';
    for (const [g, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityGesture = g;
      }
    }

    // Threshold (e.g. 80% of window size)
    if (maxCount >= Math.floor(this.windowSize * 0.8) && majorityGesture !== 'None') {
      if (this.lastEmitted !== majorityGesture) {
        this.lastEmitTime = now;
      }
      this.lastEmitted = majorityGesture;
      return majorityGesture;
    }

    // if no strong signal, and we are out of cooldown, fade to null
    this.lastEmitted = null;
    return null;
  }
}
