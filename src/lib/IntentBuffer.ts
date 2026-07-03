import { Intent } from './IntentMapper';
import {
  EffectLevel,
  getIntentBufferHoldMs,
  getIntentSwitchConfirmMs,
} from './PerformanceProfile';

/**
 * Holds stable intents smoothly while requiring a short confirmation streak
 * before a different intent can take over.
 */
export class IntentBuffer {
  private activeIntent: Intent = Intent.IDLE;
  private pendingIntent: Intent = Intent.IDLE;
  private candidateIntent: Intent = Intent.IDLE;
  private candidateCount = 0;
  private activeSince = 0;
  private pendingSince = 0;
  private effectLevel: EffectLevel = 'full';

  setEffectLevel(effectLevel: EffectLevel) {
    this.effectLevel = effectLevel;
  }

  push(intent: Intent, timestamp = performance.now()) {
    const nextIntent = intent ?? Intent.IDLE;

    if (nextIntent === this.activeIntent) {
      this.pendingIntent = nextIntent;
      this.pendingSince = timestamp;
      this.candidateIntent = nextIntent;
      this.candidateCount = 0;
      return;
    }

    if (nextIntent === this.candidateIntent) {
      this.candidateCount += 1;
    } else {
      this.candidateIntent = nextIntent;
      this.candidateCount = 1;
    }

    if (this.candidateCount < 2) {
      return;
    }

    this.pendingIntent = nextIntent;
    this.pendingSince = timestamp;
  }

  read(now = performance.now()): Intent {
    if (this.pendingIntent === this.activeIntent) {
      return this.activeIntent;
    }

    const holdMs = getIntentBufferHoldMs(this.effectLevel);
    const confirmMs = getIntentSwitchConfirmMs(this.effectLevel);
    const pendingConfirmed = now - this.pendingSince >= confirmMs;

    if (!pendingConfirmed) {
      return this.activeIntent;
    }

    const nextIntent = this.pendingIntent;
    const switchingToIdle = nextIntent === Intent.IDLE;
    const activeHeldLongEnough = now - this.activeSince >= holdMs;

    if (this.activeIntent === Intent.IDLE && nextIntent !== Intent.IDLE) {
      this.commit(nextIntent, now);
      return this.activeIntent;
    }

    if (!switchingToIdle) {
      this.commit(nextIntent, now);
      return this.activeIntent;
    }

    if (activeHeldLongEnough) {
      this.commit(nextIntent, now);
    }

    return this.activeIntent;
  }

  private commit(intent: Intent, timestamp: number) {
    this.activeIntent = intent;
    this.activeSince = timestamp;
    this.candidateIntent = intent;
    this.candidateCount = 0;
  }
}
