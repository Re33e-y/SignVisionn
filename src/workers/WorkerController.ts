export type WorkerMessage =
  | { type: 'INIT'; wasmUrl?: string; modelUrl: string }
  | { type: 'PROCESS_BITMAP'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'PROCESS_IMAGE_DATA'; imageData: ImageData; timestamp: number };

export type WorkerResponse =
  | { type: 'READY' }
  | {
      type: 'RESULT';
      gesture: string | null;
      confidence: number;
      timestamp: number;
      processingTime: number;
    }
  | { type: 'ERROR'; error: string };

function closeTransferredFrame(frame: ImageBitmap | ImageData) {
  if (frame instanceof ImageBitmap) {
    frame.close();
  }
}

export class WorkerController {
  private worker: Worker | null = null;
  private isProcessing = false;
  private onResultCallback?: (result: WorkerResponse) => void;
  private modelUrl: string | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private terminated = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.createWorker();
    }
  }

  private createWorker() {
    if (this.terminated) {
      return;
    }

    this.worker = new Worker(new URL('./vision-processor.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'READY') {
        this.restartAttempts = 0;
      }

      if (e.data.type === 'RESULT' || e.data.type === 'ERROR') {
        this.isProcessing = false;
      }

      if (e.data.type === 'ERROR') {
        this.scheduleRestart(e.data.error);
      }

      this.onResultCallback?.(e.data);
    };

    this.worker.onerror = () => {
      this.handleWorkerFailure('Worker runtime crash. Restarting.');
    };

    this.worker.onmessageerror = () => {
      this.handleWorkerFailure('Worker message error. Restarting.');
    };
  }

  private handleWorkerFailure(error: string) {
    this.isProcessing = false;
    this.onResultCallback?.({ type: 'ERROR', error });
    this.scheduleRestart(error);
  }

  private scheduleRestart(reason: string) {
    if (this.terminated || this.restartTimer) {
      return;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    const delay = Math.min(4000, 500 * 2 ** this.restartAttempts);
    this.restartAttempts += 1;

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;

      if (this.terminated) {
        return;
      }

      this.createWorker();

      if (this.worker && this.modelUrl) {
        this.worker.postMessage({
          type: 'INIT',
          modelUrl: this.modelUrl,
        } as WorkerMessage);
      }

      this.onResultCallback?.({
        type: 'ERROR',
        error: `${reason} Attempting recovery.`,
      });
    }, delay);
  }

  init(modelUrl: string) {
    this.modelUrl = modelUrl;
    if (!this.worker) {
      this.createWorker();
    }
    this.worker?.postMessage({ type: 'INIT', modelUrl } as WorkerMessage);
  }

  onResult(cb: (result: WorkerResponse) => void) {
    this.onResultCallback = cb;
  }

  sendFrame(frame: ImageBitmap | ImageData, timestamp: number): boolean {
    if (!this.worker) {
      closeTransferredFrame(frame);
      return false;
    }

    if (this.isProcessing) {
      closeTransferredFrame(frame);
      return false;
    }

    this.isProcessing = true;

    try {
      if (frame instanceof ImageBitmap) {
        this.worker.postMessage(
          { type: 'PROCESS_BITMAP', bitmap: frame, timestamp } as WorkerMessage,
          [frame],
        );
      } else {
        this.worker.postMessage(
          { type: 'PROCESS_IMAGE_DATA', imageData: frame, timestamp } as WorkerMessage,
          [frame.data.buffer],
        );
      }
      return true;
    } catch (error) {
      this.isProcessing = false;
      closeTransferredFrame(frame);
      this.handleWorkerFailure(`Worker postMessage failed: ${String(error)}`);
      return false;
    }
  }

  getIsProcessing() {
    return this.isProcessing;
  }

  terminate() {
    this.terminated = true;
    this.isProcessing = false;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
