import { GestureType } from '../../app/utils/gestureClassifier';

export class GestureHistory {
  private buffer: GestureType[] = [];
  private maxSize = 10;
  private confirmationThreshold = 4;

  push(gesture: GestureType) {
    this.buffer.push(gesture);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /**
   * Returns the stable gesture if it has been held for N frames.
   */
  getConfirmed(): GestureType {
    if (this.buffer.length < this.confirmationThreshold) return 'NONE';

    // Check last N frames
    const recent = this.buffer.slice(-this.confirmationThreshold);
    const first = recent[0];
    
    if (recent.every(g => g === first)) {
      return first;
    }

    return 'NONE';
  }

  /**
   * Simple weighted scoring based on frequency in buffer.
   */
  getConfidence(gesture: GestureType): number {
    if (this.buffer.length === 0) return 0;
    const count = this.buffer.filter(g => g === gesture).length;
    return count / this.buffer.length;
  }

  clear() {
    this.buffer = [];
  }
}
