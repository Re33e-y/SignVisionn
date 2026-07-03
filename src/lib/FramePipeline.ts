import {
  EffectLevel,
  getResolutionForEffectLevel,
} from './PerformanceProfile';

export class FramePipeline {
  private canvas?: OffscreenCanvas | HTMLCanvasElement;
  private ctx?: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  private effectLevel: EffectLevel = 'full';
  private targetResolution = getResolutionForEffectLevel('full');

  setEffectLevel(effectLevel: EffectLevel) {
    if (effectLevel === this.effectLevel) {
      return;
    }

    this.effectLevel = effectLevel;
    this.targetResolution = getResolutionForEffectLevel(effectLevel);
  }

  private initCanvasForSize(width: number, height: number) {
    const ratio = Math.min(
      this.targetResolution.width / width,
      this.targetResolution.height / height,
      1,
    );
    const targetWidth = Math.floor(width * ratio);
    const targetHeight = Math.floor(height * ratio);

    if (!this.canvas) {
      if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(targetWidth, targetHeight);
        this.ctx = this.canvas.getContext('2d', {
          willReadFrequently: true,
        }) as OffscreenCanvasRenderingContext2D;
        return;
      }

      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    if (this.canvas.width !== targetWidth) {
      this.canvas.width = targetWidth;
    }

    if (this.canvas.height !== targetHeight) {
      this.canvas.height = targetHeight;
    }
  }

  async processFrame(
    videoElement: HTMLVideoElement,
  ): Promise<ImageBitmap | ImageData | null> {
    const sourceWidth = videoElement.videoWidth;
    const sourceHeight = videoElement.videoHeight;

    if (sourceWidth === 0 || sourceHeight === 0) {
      return null;
    }

    this.initCanvasForSize(sourceWidth, sourceHeight);

    if (!this.canvas || !this.ctx) {
      return null;
    }

    try {
      if (typeof createImageBitmap !== 'undefined') {
        const bitmap = await createImageBitmap(videoElement, {
          resizeWidth: this.canvas.width,
          resizeHeight: this.canvas.height,
        });
        return bitmap;
      }
    } catch {
      // Fall back to drawImage for environments without transferable bitmap support.
    }

    this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
}
