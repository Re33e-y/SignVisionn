export type DeviceTier = 1 | 2 | 3;

export class DeviceProfiler {
  /**
   * Runs a 50ms GPU microbenchmark to determine device tier.
   */
  static async profile(): Promise<DeviceTier> {
    if (typeof window === 'undefined' || !window.OffscreenCanvas) return 1;

    const canvas = new OffscreenCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    if (!ctx) return 1;

    const start = performance.now();
    let rects = 0;
    
    // Benchmark: How many 10x10 rects can we draw in a burst?
    while (performance.now() - start < 50) {
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgb(${i},${i},${i})`;
        ctx.fillRect(Math.random() * 90, Math.random() * 90, 10, 10);
      }
      rects += 100;
    }

    const duration = performance.now() - start;
    const opsPerMs = rects / duration;

    // Tiers based on empirical benchmarks:
    // Tier 1 (High): > 1000 ops/ms
    // Tier 2 (Mid): 400 - 1000 ops/ms
    // Tier 3 (Low): < 400 ops/ms
    
    if (opsPerMs > 800) return 1;
    if (opsPerMs > 300) return 2;
    return 3;
  }

  static async getBatteryStatus(): Promise<{ level: number; charging: boolean } | null> {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        return { level: battery.level, charging: battery.charging };
      } catch {
        return null;
      }
    }
    return null;
  }
}
