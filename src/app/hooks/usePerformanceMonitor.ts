'use client';

import { startTransition, useEffect, useRef, useState } from 'react';

interface PerformanceMonitorInput {
  captureFps: number;
}

interface PerformanceSnapshot {
  renderFps: number;
  effectiveFps: number;
}

const SAMPLE_INTERVAL_MS = 500;

export function usePerformanceMonitor({
  captureFps,
}: PerformanceMonitorInput): PerformanceSnapshot {
  const captureFpsRef = useRef(captureFps);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>({
    renderFps: 0,
    effectiveFps: captureFps,
  });

  useEffect(() => {
    captureFpsRef.current = captureFps;
  }, [captureFps]);

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let lastSample = performance.now();
    let smoothedRenderFps = 0;

    const loop = (time: number) => {
      frames += 1;

      if (time - lastSample >= SAMPLE_INTERVAL_MS) {
        const elapsed = time - lastSample;
        const nextRenderFps = (frames * 1000) / elapsed;
        smoothedRenderFps =
          smoothedRenderFps === 0
            ? nextRenderFps
            : smoothedRenderFps * 0.6 + nextRenderFps * 0.4;

        const nextSnapshot: PerformanceSnapshot = {
          renderFps: smoothedRenderFps,
          effectiveFps:
            captureFpsRef.current > 0
              ? Math.min(smoothedRenderFps, captureFpsRef.current)
              : smoothedRenderFps,
        };

        startTransition(() => {
          setSnapshot((previous) => {
            if (
              Math.abs(previous.renderFps - nextSnapshot.renderFps) < 0.2 &&
              Math.abs(previous.effectiveFps - nextSnapshot.effectiveFps) < 0.2
            ) {
              return previous;
            }

            return nextSnapshot;
          });
        });

        frames = 0;
        lastSample = time;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return snapshot;
}
