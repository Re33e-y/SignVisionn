export type EffectLevel = 'full' | 'reduced' | 'minimal';

export interface ResolutionProfile {
  width: number;
  height: number;
}

export interface PerformanceMetrics {
  captureFps: number;
  deviceFps: number;
  workerLoad: number;
  dropRate: number;
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function getResolutionForEffectLevel(
  effectLevel: EffectLevel,
): ResolutionProfile {
  switch (effectLevel) {
    case 'minimal':
      return { width: 320, height: 240 };
    case 'reduced':
      return { width: 480, height: 360 };
    case 'full':
    default:
      return { width: 640, height: 480 };
  }
}

export function getIntentBufferHoldMs(effectLevel: EffectLevel) {
  return effectLevel === 'minimal' ? 150 : 250;
}

export function getIntentSwitchConfirmMs(effectLevel: EffectLevel) {
  return effectLevel === 'minimal' ? 45 : 70;
}

export function toWorkerLoad(processingTime: number) {
  return clamp(processingTime / (1000 / 30));
}

function downgrade(level: EffectLevel): EffectLevel {
  if (level === 'full') {
    return 'reduced';
  }

  if (level === 'reduced') {
    return 'minimal';
  }

  return 'minimal';
}

function upgrade(level: EffectLevel): EffectLevel {
  if (level === 'minimal') {
    return 'reduced';
  }

  if (level === 'reduced') {
    return 'full';
  }

  return 'full';
}

export class PerformanceGovernor {
  private effectLevel: EffectLevel;
  private downgradeSince = 0;
  private upgradeSince = 0;
  private forceMinimalSince = 0;
  private readonly sessionStartedAt: number;

  constructor(initialLevel: EffectLevel = 'full', startedAt = performance.now()) {
    this.effectLevel = initialLevel;
    this.sessionStartedAt = startedAt;
  }

  update(metrics: PerformanceMetrics, now = performance.now()): EffectLevel {
    const sessionTime = now - this.sessionStartedAt;
    const thermalBias = sessionTime > 120000 ? 0.05 : 0;
    const biasedWorkerLoad = clamp(metrics.workerLoad + thermalBias);
    const biasedDropRate = clamp(metrics.dropRate + thermalBias * 0.4);
    const downgradeFpsThreshold = 25 + thermalBias * 5;
    const upgradeFpsThreshold = 30 + thermalBias * 5;

    const shouldForceMinimal = metrics.captureFps > 0 && metrics.captureFps < 14;
    const shouldDowngrade =
      metrics.captureFps > 0 &&
      (metrics.captureFps < downgradeFpsThreshold ||
        biasedWorkerLoad > 0.88 ||
        biasedDropRate > 0.24);
    const shouldUpgrade =
      metrics.deviceFps > upgradeFpsThreshold &&
      biasedWorkerLoad < 0.45 &&
      biasedDropRate < 0.05;

    this.forceMinimalSince = shouldForceMinimal
      ? this.forceMinimalSince || now
      : 0;
    this.downgradeSince = shouldDowngrade ? this.downgradeSince || now : 0;
    this.upgradeSince = shouldUpgrade ? this.upgradeSince || now : 0;

    if (this.forceMinimalSince !== 0 && now - this.forceMinimalSince >= 5000) {
      this.effectLevel = 'minimal';
      this.forceMinimalSince = 0;
      this.downgradeSince = 0;
      this.upgradeSince = 0;
      return this.effectLevel;
    }

    if (this.downgradeSince !== 0 && now - this.downgradeSince >= 2000) {
      this.effectLevel = downgrade(this.effectLevel);
      this.forceMinimalSince = 0;
      this.downgradeSince = 0;
      this.upgradeSince = 0;
      return this.effectLevel;
    }

    if (this.upgradeSince !== 0 && now - this.upgradeSince >= 3000) {
      this.effectLevel = upgrade(this.effectLevel);
      this.forceMinimalSince = 0;
      this.downgradeSince = 0;
      this.upgradeSince = 0;
    }

    return this.effectLevel;
  }

  getEffectLevel() {
    return this.effectLevel;
  }
}
