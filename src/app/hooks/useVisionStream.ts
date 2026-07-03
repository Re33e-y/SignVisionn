import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import { WorkerController, WorkerResponse } from '../../workers/WorkerController';
import { FramePipeline } from '../../lib/FramePipeline';
import { GestureStabilizer } from '../../lib/GestureStabilizer';
import { IntentMapper, Intent } from '../../lib/IntentMapper';
import { IntentBuffer } from '../../lib/IntentBuffer';
import { RuntimeProfiler } from '../../lib/RuntimeProfiler';
import {
  EffectLevel,
  getResolutionForEffectLevel,
  PerformanceGovernor,
  toWorkerLoad,
} from '../../lib/PerformanceProfile';

interface NavigatorDeviceInfo extends Navigator {
  deviceMemory?: number;
}

interface UseVisionStreamResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentIntent: Intent;
  captureFps: number;
  deviceFps: number;
  effectLevel: EffectLevel;
  workerLoad: number;
  dropRate: number;
  isReady: boolean;
  workerProcessingTime: number;
  workerDroppedFrames: number;
  attemptedFrames: number;
  statusText: string;
  needsUserStart: boolean;
  isMobile: boolean;
  resolutionLabel: string;
  startVision: () => void;
}

interface VisionUiState {
  currentIntent: Intent;
  captureFps: number;
  deviceFps: number;
  effectLevel: EffectLevel;
  workerLoad: number;
  dropRate: number;
  isReady: boolean;
  workerProcessingTime: number;
  workerDroppedFrames: number;
  attemptedFrames: number;
  statusText: string;
  needsUserStart: boolean;
  isMobile: boolean;
  resolutionLabel: string;
}

const INITIAL_UI_STATE: VisionUiState = {
  currentIntent: Intent.IDLE,
  captureFps: 0,
  deviceFps: 0,
  effectLevel: 'full',
  workerLoad: 0,
  dropRate: 0,
  isReady: false,
  workerProcessingTime: 0,
  workerDroppedFrames: 0,
  attemptedFrames: 0,
  statusText: 'Initializing model...',
  needsUserStart: false,
  isMobile: false,
  resolutionLabel: '640x480',
};

function getCameraConstraints(isMobile: boolean, lowTier: boolean) {
  const width = isMobile || lowTier ? 480 : 640;
  const height = isMobile || lowTier ? 360 : 480;

  return {
    video: {
      facingMode: 'user',
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  } satisfies MediaStreamConstraints;
}

export function useVisionStream(): UseVisionStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startVisionRef = useRef<() => void>(() => {});
  const [uiState, setUiState] = useState<VisionUiState>(INITIAL_UI_STATE);

  const systemRefs = useRef({
    controller: null as WorkerController | null,
    pipeline: null as FramePipeline | null,
    stabilizer: null as GestureStabilizer | null,
    mapper: null as IntentMapper | null,
    intentBuffer: null as IntentBuffer | null,
    deviceProfiler: null as RuntimeProfiler | null,
    captureProfiler: null as RuntimeProfiler | null,
    governor: null as PerformanceGovernor | null,
    captureLoopId: 0,
    uiLoopId: 0,
    cameraRestartTimerId: 0,
    isActive: false,
    isCapturing: false,
    isDocumentVisible: true,
    isTouching: false,
    startInFlight: false,
    skipFramesRemaining: 0,
    droppedCount: 0,
    attemptedCount: 0,
    latestCaptureFps: 0,
    latestDeviceFps: 0,
    latestProcessingTime: 0,
    workerLoad: 0,
    effectLevel: 'full' as EffectLevel,
    isReady: false,
    statusText: 'Initializing model...',
    needsUserStart: false,
    startedAt: performance.now(),
    currentStream: null as MediaStream | null,
    trackEndCleanups: [] as Array<() => void>,
    isMobile: false,
    lowTier: false,
  });

  const clearCameraRestartTimer = useEffectEvent(() => {
    const sys = systemRefs.current;
    if (sys.cameraRestartTimerId !== 0) {
      window.clearTimeout(sys.cameraRestartTimerId);
      sys.cameraRestartTimerId = 0;
    }
  });

  const setStatus = useEffectEvent((statusText: string, needsUserStart = false) => {
    const sys = systemRefs.current;
    sys.statusText = statusText;
    sys.needsUserStart = needsUserStart;
  });

  const cleanupCurrentStream = useEffectEvent((stopTracks: boolean) => {
    const sys = systemRefs.current;

    sys.trackEndCleanups.forEach((cleanup) => cleanup());
    sys.trackEndCleanups = [];

    if (stopTracks) {
      sys.currentStream?.getTracks().forEach((track) => track.stop());
    }

    sys.currentStream = null;
  });

  const syncAdaptiveState = useEffectEvent((now: number) => {
    const sys = systemRefs.current;
    const dropRate =
      sys.attemptedCount > 0 ? sys.droppedCount / sys.attemptedCount : 0;

    const nextEffectLevel =
      sys.governor?.update(
        {
          captureFps: sys.latestCaptureFps,
          deviceFps: sys.latestDeviceFps,
          workerLoad: sys.workerLoad,
          dropRate,
        },
        now,
      ) ?? sys.effectLevel;

    sys.effectLevel = nextEffectLevel;
    sys.pipeline?.setEffectLevel(nextEffectLevel);
    sys.intentBuffer?.setEffectLevel(nextEffectLevel);
  });

  const syncUiState = useEffectEvent((time: number) => {
    const sys = systemRefs.current;
    const dropRate =
      sys.attemptedCount > 0 ? sys.droppedCount / sys.attemptedCount : 0;
    const resolution = getResolutionForEffectLevel(sys.effectLevel);

    const nextState: VisionUiState = {
      currentIntent: sys.intentBuffer?.read(time) ?? Intent.IDLE,
      captureFps: sys.latestCaptureFps,
      deviceFps: sys.latestDeviceFps,
      effectLevel: sys.effectLevel,
      workerLoad: sys.workerLoad,
      dropRate,
      isReady: sys.isReady,
      workerProcessingTime: sys.latestProcessingTime,
      workerDroppedFrames: sys.droppedCount,
      attemptedFrames: sys.attemptedCount,
      statusText: sys.statusText,
      needsUserStart: sys.needsUserStart,
      isMobile: sys.isMobile,
      resolutionLabel: `${resolution.width}x${resolution.height}`,
    };

    startTransition(() => {
      setUiState((previous) => {
        if (
          previous.currentIntent === nextState.currentIntent &&
          Math.abs(previous.captureFps - nextState.captureFps) < 0.2 &&
          Math.abs(previous.deviceFps - nextState.deviceFps) < 0.2 &&
          previous.effectLevel === nextState.effectLevel &&
          Math.abs(previous.workerLoad - nextState.workerLoad) < 0.01 &&
          Math.abs(previous.dropRate - nextState.dropRate) < 0.01 &&
          previous.isReady === nextState.isReady &&
          Math.abs(previous.workerProcessingTime - nextState.workerProcessingTime) < 0.2 &&
          previous.workerDroppedFrames === nextState.workerDroppedFrames &&
          previous.attemptedFrames === nextState.attemptedFrames &&
          previous.statusText === nextState.statusText &&
          previous.needsUserStart === nextState.needsUserStart &&
          previous.isMobile === nextState.isMobile &&
          previous.resolutionLabel === nextState.resolutionLabel
        ) {
          return previous;
        }

        return nextState;
      });
    });
  });

  const scheduleCameraRestart = useEffectEvent((reason: string) => {
    const sys = systemRefs.current;
    if (!sys.isActive || sys.cameraRestartTimerId !== 0) {
      return;
    }

    setStatus(reason);

    sys.cameraRestartTimerId = window.setTimeout(() => {
      sys.cameraRestartTimerId = 0;
      startCamera();
    }, 800);
  });

  const startCamera = useEffectEvent(async () => {
    const sys = systemRefs.current;
    const videoElement = videoRef.current;

    if (!sys.isActive || sys.startInFlight) {
      return;
    }

    clearCameraRestartTimer();
    sys.startInFlight = true;
    setStatus('Initializing camera...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        getCameraConstraints(sys.isMobile, sys.lowTier),
      );

      if (!sys.isActive) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cleanupCurrentStream(true);
      sys.currentStream = stream;

      stream.getTracks().forEach((track) => {
        const handleEnded = () => {
          scheduleCameraRestart('Camera interrupted. Reconnecting...');
        };
        track.addEventListener('ended', handleEnded);
        sys.trackEndCleanups.push(() => {
          track.removeEventListener('ended', handleEnded);
        });
      });

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.playsInline = true;
      }

      try {
        await videoElement?.play();
        setStatus(
          sys.isReady ? 'Optimizing performance...' : 'Loading model...',
          false,
        );
      } catch {
        setStatus('Tap to start camera', true);
      }
    } catch (error) {
      const errorName =
        error instanceof DOMException ? error.name : 'UnknownError';

      if (errorName === 'NotAllowedError') {
        setStatus('Camera permission denied', true);
      } else if (errorName === 'NotReadableError') {
        setStatus('Camera busy. Retrying...');
        scheduleCameraRestart('Camera busy. Retrying...');
      } else {
        setStatus('Camera unavailable. Retrying...');
        scheduleCameraRestart('Camera unavailable. Retrying...');
      }
    } finally {
      sys.startInFlight = false;
      syncUiState(performance.now());
    }
  });

  const startVisionInternal = useEffectEvent(() => {
    const sys = systemRefs.current;
    const videoElement = videoRef.current;

    sys.needsUserStart = false;

    if (videoElement?.srcObject) {
      videoElement
        .play()
        .then(() => {
          setStatus(sys.isReady ? 'Optimizing performance...' : 'Loading model...');
          syncUiState(performance.now());
        })
        .catch(() => {
          setStatus('Tap to start camera', true);
          syncUiState(performance.now());
        });
      return;
    }

    void startCamera();
  });

  const handleWorkerMessage = useEffectEvent((res: WorkerResponse) => {
    const sys = systemRefs.current;

    if (res.type === 'READY') {
      sys.isReady = true;
      if (!sys.needsUserStart) {
        setStatus('Optimizing performance...');
      }
      return;
    }

    if (res.type === 'ERROR') {
      setStatus('Recovering worker...');
      return;
    }

    sys.latestProcessingTime = res.processingTime;

    const currentWorkerLoad = toWorkerLoad(res.processingTime);
    sys.workerLoad =
      sys.workerLoad === 0
        ? currentWorkerLoad
        : 0.2 * currentWorkerLoad + 0.8 * sys.workerLoad;

    const rawGesture =
      res.gesture && res.confidence >= 0.55 ? res.gesture : 'None';
    const stabilizedGesture = sys.stabilizer?.process(rawGesture) ?? null;
    const intent = sys.mapper?.map(stabilizedGesture) ?? Intent.IDLE;
    sys.intentBuffer?.push(intent, res.timestamp);

    if (!sys.needsUserStart && sys.currentStream) {
      setStatus('Ready');
    }

    syncAdaptiveState(performance.now());
  });

  useEffect(() => {
    const sys = systemRefs.current;
    const videoElement = videoRef.current;
    const navigatorInfo = navigator as NavigatorDeviceInfo;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    sys.isActive = true;
    sys.isMobile = coarsePointer;
    sys.lowTier =
      (navigatorInfo.deviceMemory ?? Number.POSITIVE_INFINITY) <= 4 ||
      (navigator.hardwareConcurrency ?? Number.POSITIVE_INFINITY) <= 4;

    const initialEffectLevel: EffectLevel =
      sys.lowTier || sys.isMobile ? 'reduced' : 'full';

    sys.effectLevel = initialEffectLevel;
    sys.controller = new WorkerController();
    sys.pipeline = new FramePipeline();
    sys.stabilizer = new GestureStabilizer(5, 250);
    sys.mapper = new IntentMapper();
    sys.intentBuffer = new IntentBuffer();
    sys.deviceProfiler = new RuntimeProfiler();
    sys.captureProfiler = new RuntimeProfiler();
    sys.governor = new PerformanceGovernor(initialEffectLevel, sys.startedAt);
    sys.pipeline.setEffectLevel(initialEffectLevel);
    sys.intentBuffer.setEffectLevel(initialEffectLevel);
    setStatus('Initializing model...');

    sys.controller.init('/models/gesture_recognizer.task');
    sys.controller.onResult((result: WorkerResponse) => {
      handleWorkerMessage(result);
    });

    const UI_TARGET_FPS = 30;
    const UI_FRAME_INTERVAL = 1000 / UI_TARGET_FPS;
    let lastUiCommit = 0;
    let lastCaptureTime = 0;

    const processLoop = async (time: number) => {
      if (!sys.isActive) {
        return;
      }

      sys.captureLoopId = requestAnimationFrame(processLoop);
      sys.deviceProfiler?.tick(time);
      sys.latestDeviceFps = sys.deviceProfiler?.getFPS(time) ?? 0;
      sys.latestCaptureFps = sys.captureProfiler?.getFPS(time) ?? 0;
      syncAdaptiveState(time);

      if (
        !sys.isDocumentVisible ||
        sys.isTouching ||
        time - lastCaptureTime < 1000 / 30
      ) {
        return;
      }

      lastCaptureTime = time;

      const videoElement = videoRef.current;
      if (!videoElement || videoElement.readyState < 2 || sys.isCapturing) {
        return;
      }

      sys.attemptedCount += 1;

      if (sys.controller?.getIsProcessing()) {
        sys.droppedCount += 1;
        syncAdaptiveState(time);
        return;
      }

      sys.isCapturing = true;
      let frameOrBitmap: ImageBitmap | ImageData | null = null;

      try {
        frameOrBitmap = (await sys.pipeline?.processFrame(videoElement)) ?? null;
        if (!frameOrBitmap || !sys.controller) {
          return;
        }

        const sent = sys.controller.sendFrame(frameOrBitmap, performance.now());
        frameOrBitmap = null;

        if (!sent) {
          sys.droppedCount += 1;
          syncAdaptiveState(performance.now());
          return;
        }

        sys.captureProfiler?.tick(time);
        sys.latestCaptureFps = sys.captureProfiler?.getFPS(time) ?? 0;
      } finally {
        if (frameOrBitmap instanceof ImageBitmap) {
          frameOrBitmap.close();
        }
        sys.isCapturing = false;
      }
    };

    const uiLoop = (time: number) => {
      if (!sys.isActive) {
        return;
      }

      sys.uiLoopId = requestAnimationFrame(uiLoop);

      if (time - lastUiCommit < UI_FRAME_INTERVAL) {
        return;
      }

      lastUiCommit = time;
      syncUiState(time);
    };

    const handleVisibilityChange = () => {
      sys.isDocumentVisible = !document.hidden;

      if (document.hidden) {
        setStatus('Paused in background');
      } else if (!sys.currentStream || sys.currentStream.getTracks().every((track) => track.readyState === 'ended')) {
        void startCamera();
      } else {
        videoElement?.play().catch(() => {
          setStatus('Tap to resume camera', true);
          syncUiState(performance.now());
        });

        if (!sys.needsUserStart) {
          setStatus(sys.isReady ? 'Ready' : 'Loading model...');
        }
      }
    };

    const handleTouchStart = () => {
      sys.isTouching = true;
    };

    const handleTouchEnd = () => {
      sys.isTouching = false;
    };

    const handleVideoError = () => {
      scheduleCameraRestart('Camera stream error. Reconnecting...');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    videoElement?.addEventListener('error', handleVideoError);

    startVisionRef.current = () => {
      startVisionInternal();
    };

    sys.captureLoopId = requestAnimationFrame(processLoop);
    sys.uiLoopId = requestAnimationFrame(uiLoop);
    void startCamera();

    return () => {
      sys.isActive = false;
      clearCameraRestartTimer();
      cancelAnimationFrame(sys.captureLoopId);
      cancelAnimationFrame(sys.uiLoopId);
      sys.controller?.terminate();
      cleanupCurrentStream(true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      videoElement?.removeEventListener('error', handleVideoError);
    };
  }, []);

  const startVision = () => {
    startVisionRef.current();
  };

  return {
    videoRef,
    currentIntent: uiState.currentIntent,
    captureFps: uiState.captureFps,
    deviceFps: uiState.deviceFps,
    effectLevel: uiState.effectLevel,
    workerLoad: uiState.workerLoad,
    dropRate: uiState.dropRate,
    isReady: uiState.isReady,
    workerProcessingTime: uiState.workerProcessingTime,
    workerDroppedFrames: uiState.workerDroppedFrames,
    attemptedFrames: uiState.attemptedFrames,
    statusText: uiState.statusText,
    needsUserStart: uiState.needsUserStart,
    isMobile: uiState.isMobile,
    resolutionLabel: uiState.resolutionLabel,
    startVision,
  };
}
