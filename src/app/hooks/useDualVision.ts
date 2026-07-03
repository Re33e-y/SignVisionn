import { useEffect, useRef, useState } from 'react';
import { DeviceProfiler, DeviceTier } from '@/lib/utils/deviceProfiler';
import { VISION_WORKER_SOURCE, COMPOSITOR_WORKER_SOURCE, ASL_WORKER_SOURCE } from '../workers/workerSource';

export function useDualVision() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionWorkerRef = useRef<Worker | null>(null);
  const compositorWorkerRef = useRef<Worker | null>(null);
  const aslWorkerRef = useRef<Worker | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [tier, setTier] = useState<DeviceTier>(1);
  const [battery, setBattery] = useState({ level: 1.0, charging: true });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aslWord, setAslWord] = useState("");

  const state = useRef({
    isActive: true,
    frameCount: 0,
    lastTime: 0,
    frames: 0,
    lastFpsTime: 0,
    isVisionReady: false,
    isCompositorReady: false,
    isAslReady: false,
    lastProcessingTime: 0,
    lastAslResult: { letter: '', confidence: 0 },
    aslHistory: [] as string[],
    stableLetter: '',
    assignedTier: 1 as DeviceTier,
  });

  const isTransferred = useRef(false);
  const workerBusy = useRef(false);
  const aslBusy = useRef(false);
  const workerBusyTimeout = useRef<any>(null);

  const nextCaptureLabelRef = useRef<string | null>(null);

  const saveBitmapToDisk = (bitmap: ImageBitmap, label: string) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 224;
    tempCanvas.height = 224;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(bitmap, 0, 0);
      const dataUrl = tempCanvas.toDataURL('image/png');
      fetch('/api/save-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, image: dataUrl })
      }).then(res => res.json())
        .then(data => {
          console.log('[useDualVision] Saved frame:', data);
          const event = new CustomEvent('frame-saved', { detail: { label, filename: data.filename } });
          window.dispatchEvent(event);
        })
        .catch(err => console.error('[useDualVision] Failed to save frame:', err));
    }
  };

  const captureFrame = (label: string) => {
    nextCaptureLabelRef.current = label;
  };

  useEffect(() => {
    async function init() {
      if (isTransferred.current) return;

      // ── 1. Spin up all three workers immediately (parallel, not sequential) ──
      const compositorBlob = new Blob([COMPOSITOR_WORKER_SOURCE], { type: 'application/javascript' });
      const compositor = new Worker(URL.createObjectURL(compositorBlob));
      compositorWorkerRef.current = compositor;

      const visionBlob = new Blob([VISION_WORKER_SOURCE], { type: 'application/javascript' });
      const vision = new Worker(URL.createObjectURL(visionBlob));
      visionWorkerRef.current = vision;

      const aslBlob = new Blob([ASL_WORKER_SOURCE], { type: 'application/javascript' });
      const aslWorker = new Worker(URL.createObjectURL(aslBlob));
      aslWorkerRef.current = aslWorker;

      // ── 2. Transfer canvas immediately — don't wait for device profiling ──
      if (canvasRef.current && !isTransferred.current) {
        try {
          const offscreen = canvasRef.current.transferControlToOffscreen();
          // Send with tier=1 default; update after profiling completes
          compositor.postMessage({ type: 'INIT', canvas: offscreen, tier: 1 }, [offscreen]);
          isTransferred.current = true;
        } catch (e) {
          console.warn("Compositor Transfer Skip:", e);
        }
      }

      // ── 3. Fire all INIT messages immediately — workers boot in parallel ──
      vision.postMessage({ type: 'INIT' });
      aslWorker.postMessage({ type: 'INIT' });

      // ── 4. Start camera immediately — don't wait for anything ──
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      }).then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Auto-play blocked:", e));
          };
        }
      }).catch(err => {
        console.error("Camera Error:", err);
        setCameraError(err instanceof Error ? err.message : String(err));
      });

      // ── 5. Device profiling + battery run in background, non-blocking ──
      DeviceProfiler.profile().then(assignedTier => {
        state.current.assignedTier = assignedTier;
        setTier(assignedTier);
      });
      DeviceProfiler.getBatteryStatus().then(batteryStatus => {
        if (batteryStatus) {
          setBattery(batteryStatus);
          vision.postMessage({ type: 'BATTERY', level: batteryStatus.level });
        }
      });

      // ── 6. Wire ASL worker messages ──
      aslWorker.onmessage = (e) => {
        if (e.data.type === 'READY') state.current.isAslReady = true;
        if (e.data.type === 'RESULT') {
          const { letter, confidence } = e.data;
          state.current.lastAslResult = { letter, confidence };

          if (confidence > 0.85) {
            state.current.aslHistory.push(letter);
            if (state.current.aslHistory.length > 5) state.current.aslHistory.shift();
            const isStable =
              state.current.aslHistory.length === 5 &&
              state.current.aslHistory.every(l => l === letter);

            if (isStable && state.current.stableLetter !== letter) {
              state.current.stableLetter = letter;
              if (letter) {
                setAslWord(prev => prev + letter);
              }
            }
          } else {
            state.current.stableLetter = '';
          }

          compositor.postMessage({ type: 'SET_ASL', letter, confidence });
          aslBusy.current = false;
        }
      };

      // ── 7. Wire Vision worker messages ──
      vision.onmessage = (e) => {
        if (e.data.type === 'READY') {
          state.current.isVisionReady = true;
          setIsReady(true);
        }
        if (e.data.type === 'RESULT') {
          state.current.lastProcessingTime = e.data.processingTime;

          compositor.postMessage({
            type: 'RENDER',
            frame: e.data.frame,
            landmarks: e.data.landmarks,
            mask: e.data.mask,
            timestamp: e.data.timestamp,
          }, e.data.frame ? [e.data.frame] : []);

          workerBusy.current = false;
          if (workerBusyTimeout.current) clearTimeout(workerBusyTimeout.current);

          // ASL crop + classify
          if (
            e.data.landmarks?.length > 0 &&
            !aslBusy.current &&
            state.current.isAslReady
          ) {
            const landmarks = e.data.landmarks[0];
            const video = videoRef.current;
            if (video) {
              let minX = 1, maxX = 0, minY = 1, maxY = 0;
              for (const p of landmarks) {
                if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
              }
              const w = maxX - minX, h = maxY - minY;
              const pad = Math.max(w, h) * 0.15;
              const sx = Math.max(0, (minX - pad) * video.videoWidth);
              const sy = Math.max(0, (minY - pad) * video.videoHeight);
              const sw = Math.min(video.videoWidth - sx, (w + 2 * pad) * video.videoWidth);
              const sh = Math.min(video.videoHeight - sy, (h + 2 * pad) * video.videoHeight);

              if (sw > 10 && sh > 10) {
                aslBusy.current = true;
                createImageBitmap(video, Math.floor(sx), Math.floor(sy), Math.floor(sw), Math.floor(sh), {
                  resizeWidth: 224,
                  resizeHeight: 224,
                  resizeQuality: 'medium',
                }).then(crop => {
                  // Capture exact crop if requested
                  if (nextCaptureLabelRef.current && nextCaptureLabelRef.current !== 'background') {
                    const label = nextCaptureLabelRef.current;
                    nextCaptureLabelRef.current = null;
                    saveBitmapToDisk(crop, label);
                  }

                  aslWorkerRef.current?.postMessage(
                    { type: 'CLASSIFY', bitmap: crop, timestamp: e.data.timestamp },
                    [crop]
                  );
                }).catch(() => { aslBusy.current = false; });
              }
            }
          }
        }
      };

      // ── 8. Wait for camera before starting the loop ──
      await cameraPromise;

      // ── 9. Capture loop ──
      const loop = (time: number) => {
        if (!state.current.isActive) return;
        requestAnimationFrame(loop);

        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) return;

        // Handle immediate background capture
        if (nextCaptureLabelRef.current === 'background') {
          const label = nextCaptureLabelRef.current;
          nextCaptureLabelRef.current = null;
          const cx = Math.floor((video.videoWidth - 224) / 2);
          const cy = Math.floor((video.videoHeight - 224) / 2);
          createImageBitmap(video, cx, cy, 224, 224).then(crop => {
            saveBitmapToDisk(crop, label);
          }).catch((err) => console.error('[useDualVision] BG capture error:', err));
        }

        if (time - state.current.lastTime < 1000 / 60) return;
        state.current.lastTime = time;

        state.current.frames++;
        if (time - state.current.lastFpsTime > 1000) {
          setFps(state.current.frames);
          setProcessingTime(parseFloat(state.current.lastProcessingTime.toFixed(1)));
          state.current.frames = 0;
          state.current.lastFpsTime = time;
        }

        const { level, charging } = battery;
        const batterySkip = level < 0.2 && !charging && state.current.frameCount % 2 === 0;

        // Direct blit: vision not ready yet, or worker busy, or battery saving
        if (!state.current.isVisionReady || workerBusy.current || batterySkip) {
          createImageBitmap(video).then(bitmap => {
            if (!state.current.isActive) { bitmap.close(); return; }
            compositor.postMessage({ type: 'RENDER', frame: bitmap, isDirect: true }, [bitmap]);
          }).catch(() => { });
          if (workerBusy.current || !state.current.isVisionReady) return;
        }

        // Normal inference path
        createImageBitmap(video).then(bitmap => {
          if (!state.current.isActive) { bitmap.close(); return; }
          workerBusy.current = true;
          if (workerBusyTimeout.current) clearTimeout(workerBusyTimeout.current);
          workerBusyTimeout.current = setTimeout(() => { workerBusy.current = false; }, 500);

          visionWorkerRef.current?.postMessage({
            type: 'PROCESS',
            bitmap,
            timestamp: time,
            skipSegmentation: state.current.assignedTier === 3,
          }, [bitmap]);
        }).catch(() => { });

        state.current.frameCount++;
      };

      requestAnimationFrame(loop);
    }

    init();

    return () => {
      state.current.isActive = false;
      visionWorkerRef.current?.terminate();
      compositorWorkerRef.current?.terminate();
      aslWorkerRef.current?.terminate();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isReady,
    fps,
    processingTime,
    tier,
    battery,
    cameraError,
    aslResult: state.current.lastAslResult,
    aslWord,
    isAslReady: state.current.isAslReady,
    captureFrame,
  };
}
