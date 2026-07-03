'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useDeferredValue } from 'react';
import { Intent } from '../../lib/IntentMapper';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useVisionStream } from '../hooks/useVisionStream';

const PARTICLE_LAYOUT = [
  { top: '10%', left: '14%', size: 10, duration: 8.6, delay: 0.1 },
  { top: '18%', left: '76%', size: 8, duration: 7.4, delay: 0.3 },
  { top: '24%', left: '54%', size: 6, duration: 6.9, delay: 0.6 },
  { top: '28%', left: '24%', size: 5, duration: 8.2, delay: 0.8 },
  { top: '34%', left: '84%', size: 8, duration: 7.8, delay: 0.5 },
  { top: '42%', left: '12%', size: 7, duration: 6.7, delay: 0.2 },
  { top: '46%', left: '70%', size: 11, duration: 8.1, delay: 1.1 },
  { top: '56%', left: '30%', size: 6, duration: 7.2, delay: 0.9 },
  { top: '62%', left: '82%', size: 9, duration: 8.4, delay: 0.4 },
  { top: '70%', left: '18%', size: 7, duration: 7.9, delay: 0.7 },
  { top: '76%', left: '58%', size: 10, duration: 8.8, delay: 1.2 },
  { top: '84%', left: '40%', size: 6, duration: 7.1, delay: 0.2 },
];

const UI_TRANSITION = {
  duration: 0.5,
  ease: 'easeOut' as const,
};

const DEBUG_PANEL = true; // Forced for emergency troubleshooting

function getParticleCount(
  effectLevel: 'full' | 'reduced' | 'minimal',
  isMobile: boolean,
) {
  if (effectLevel === 'minimal') {
    return 0;
  }

  if (isMobile) {
    return 5;
  }

  if (effectLevel === 'reduced') {
    return 6;
  }

  return PARTICLE_LAYOUT.length;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getStatusDetail(statusText: string) {
  if (statusText.includes('model')) {
    return 'Warming up the worker and MediaPipe runtime.';
  }

  if (statusText.includes('camera')) {
    return 'Negotiating camera access and preparing the gesture stage.';
  }

  if (statusText.includes('Recovering')) {
    return 'The pipeline hit an edge case and is healing itself in the background.';
  }

  if (statusText.includes('Paused')) {
    return 'Processing is paused while the tab is in the background.';
  }

  if (statusText.includes('Tap')) {
    return 'One quick tap is enough to resume video playback on mobile browsers.';
  }

  if (statusText.includes('permission')) {
    return 'Camera access is required for gesture matching.';
  }

  if (statusText === 'Ready') {
    return 'System active. Use hand gestures to explore.';
  }

  return 'Syncing biometric state...';
}

function getIntentMeta(intent: Intent) {
  switch (intent) {
    case Intent.DISCOVER:
      return {
        eyebrow: 'Exploration',
        description: 'Scale-first reveal with softened edges while the system scans for the next move.',
        accentClass: 'from-[#7df0d5] via-[#8ed8ff] to-[#f6bf7a]',
        ringClass: 'border-[#8df5df]/50 bg-[#8df5df]/12',
      };
    case Intent.LAUNCH:
      return {
        eyebrow: 'Momentum',
        description: 'Intent lifts upward with a short rise to feel deliberate instead of twitch-reactive.',
        accentClass: 'from-[#ffd27a] via-[#ff9f6d] to-[#fff2b1]',
        ringClass: 'border-[#ffb46d]/55 bg-[#ffb46d]/12',
      };
    case Intent.CONNECT:
      return {
        eyebrow: 'Handshake',
        description: 'A pulse-driven state that keeps attention steady while the gesture remains active.',
        accentClass: 'from-[#82d4ff] via-[#9c9cff] to-[#80f1ea]',
        ringClass: 'border-[#8ac8ff]/50 bg-[#8ac8ff]/10',
      };
    case Intent.DISMISS:
      return {
        eyebrow: 'Release',
        description: 'The UI decays cleanly instead of snapping away the moment confidence dips.',
        accentClass: 'from-[#ff9f9f] via-[#ffc17c] to-[#ff7a7a]',
        ringClass: 'border-[#ff9a7a]/50 bg-[#ff9a7a]/10',
      };
    case Intent.UNKNOWN:
      return {
        eyebrow: 'Ambiguous',
        description: 'The system is seeing a hand shape, but it has not mapped cleanly to a rehearsed intent yet.',
        accentClass: 'from-[#d0d7e2] via-[#9eb3c9] to-[#d0d7e2]',
        ringClass: 'border-white/15 bg-white/8',
      };
    case Intent.IDLE:
    default:
      return {
        eyebrow: 'Standby',
        description: 'Buffered idle keeps the stage calm while the pipeline catches up and settles.',
        accentClass: 'from-[#a8b4c4] via-[#77879f] to-[#d3dbe6]',
        ringClass: 'border-white/10 bg-white/6',
      };
  }
}

function getIntentAnimation(intent: Intent) {
  switch (intent) {
    case Intent.DISCOVER:
      return {
        initial: { opacity: 0, scale: 0.92, y: 12 },
        animate: { opacity: 1, scale: 1.02, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: -10 },
      };
    case Intent.LAUNCH:
      return {
        initial: { opacity: 0, scale: 0.94, y: 34 },
        animate: { opacity: 1, scale: 1.03, y: -8 },
        exit: { opacity: 0, scale: 0.98, y: -28 },
      };
    case Intent.CONNECT:
      return {
        initial: { opacity: 0, scale: 0.96, y: 6 },
        animate: { opacity: 1, scale: 1.01, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: -6 },
      };
    case Intent.DISMISS:
      return {
        initial: { opacity: 0.3, scale: 1.02, y: 0 },
        animate: { opacity: 0.88, scale: 0.97, y: 12 },
        exit: { opacity: 0, scale: 0.92, y: 20 },
      };
    case Intent.IDLE:
    case Intent.UNKNOWN:
    default:
      return {
        initial: { opacity: 0, scale: 0.98, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: -6 },
      };
  }
}

export default function AdaptiveReelCanvas() {
  const {
    videoRef,
    currentIntent,
    captureFps,
    deviceFps,
    effectLevel,
    workerLoad,
    dropRate,
    isReady,
    workerProcessingTime,
    workerDroppedFrames,
    statusText,
    needsUserStart,
    isMobile,
    resolutionLabel,
    startVision,
  } = useVisionStream();

  const { renderFps, effectiveFps } = usePerformanceMonitor({ captureFps });

  const deferredIntent = useDeferredValue(currentIntent);
  const deferredEffectLevel = useDeferredValue(effectLevel);
  const visualEffectLevel =
    isMobile && deferredEffectLevel === 'full' ? 'reduced' : deferredEffectLevel;
  const intentMeta = getIntentMeta(deferredIntent);
  const intentAnimation = getIntentAnimation(deferredIntent);
  const particleCount = getParticleCount(visualEffectLevel, isMobile);
  const showAmbientBlur = visualEffectLevel === 'full' && !isMobile;
  const showGlow = visualEffectLevel !== 'minimal';
  const panelClass =
    visualEffectLevel === 'full'
      ? 'border-white/18 bg-[#07111c]/58 shadow-[0_0_70px_rgba(126,240,213,0.12)] backdrop-blur-xl'
      : visualEffectLevel === 'reduced'
        ? 'border-white/14 bg-[#07111c]/72 shadow-[0_0_40px_rgba(126,240,213,0.08)]'
        : 'border-white/10 bg-[#07111c]/84';

  return (
    <main className="app-shell relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-[#020408] px-4 text-white sm:px-6">
      <div className="grain-overlay" />
      <div className="mesh-grid" />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover select-none pointer-events-none transition-opacity duration-700 ${
          visualEffectLevel === 'minimal'
            ? 'opacity-[0.22]'
            : visualEffectLevel === 'reduced'
              ? 'opacity-[0.16]'
              : 'opacity-[0.24]'
        }`}
      />

      <motion.div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,240,213,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(246,191,122,0.1),transparent_35%)]"
        animate={{
          opacity: deferredIntent === Intent.IDLE ? 0.6 : 1,
        }}
        transition={{ duration: 1 }}
      />
      
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,8,0.4)_0%,transparent_20%,transparent_80%,rgba(2,4,8,0.6)_100%)]" />

      {showAmbientBlur && (
        <>
          <motion.div
            key={`orb-1-${deferredIntent}`}
            className="absolute left-[10%] top-[15%] h-80 w-80 rounded-full bg-[#74f0dd]/12 blur-[100px]"
            animate={{ 
              x: [0, 20, -15, 0], 
              y: [0, -15, 20, 0],
              scale: [1, 1.1, 0.9, 1],
              opacity: [0.12, 0.18, 0.12]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            key={`orb-2-${deferredIntent}`}
            className="absolute right-[12%] bottom-[20%] h-[30rem] w-[30rem] rounded-full bg-[#f7be72]/10 blur-[120px]"
            animate={{ 
              x: [0, -30, 20, 0], 
              y: [0, 20, -25, 0],
              scale: [1, 0.9, 1.1, 1],
              opacity: [0.08, 0.14, 0.08]
            }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {DEBUG_PANEL && (
        <div className="absolute left-4 top-4 z-20 w-[min(22rem,calc(100%-2rem))] rounded-3xl border border-white/10 bg-[#07111c]/78 p-4 text-xs text-white/78 shadow-[0_14px_40px_rgba(0,0,0,0.32)] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.28em] text-white/45">
              System Load
            </div>
            <div className="mt-1 text-sm font-semibold tracking-[0.12em] text-white">
              {visualEffectLevel.toUpperCase()} UI
            </div>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em] ${
              visualEffectLevel === 'full'
                ? 'border-[#8df5df]/35 bg-[#8df5df]/12 text-[#8df5df]'
                : visualEffectLevel === 'reduced'
                  ? 'border-[#f7be72]/35 bg-[#f7be72]/10 text-[#f7be72]'
                  : 'border-[#ff9a7a]/35 bg-[#ff9a7a]/10 text-[#ff9a7a]'
            }`}
          >
            Adaptive
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Pipeline FPS</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {captureFps.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Render FPS</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {renderFps.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Device FPS</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {deviceFps.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Effective FPS</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {effectiveFps.toFixed(1)}
            </div>
          </div>
          <div className="col-span-2">
            <div className="uppercase tracking-[0.2em] text-white/38">Inference</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {workerProcessingTime.toFixed(1)}ms
            </div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Resolution</div>
            <div className="mt-1 text-lg font-semibold text-white">{resolutionLabel}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.2em] text-white/38">Session</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {isMobile ? 'Mobile' : 'Desktop'}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-white/38">Worker Load</span>
            <span className="font-medium text-white">{formatPercent(workerLoad)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#7df0d5] via-[#8ed8ff] to-[#f7be72]"
              animate={{ width: formatPercent(workerLoad) }}
              transition={UI_TRANSITION}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-white/38">Drop Rate</span>
            <span className="font-medium text-white">{formatPercent(dropRate)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#ff9a7a] via-[#f7be72] to-[#fff1ad]"
              animate={{ width: formatPercent(dropRate) }}
              transition={UI_TRANSITION}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-white/55">
          <span>Queue drops: {workerDroppedFrames}</span>
          <span>{statusText}</span>
        </div>
        </div>
      )}

      {(statusText !== 'Ready' || needsUserStart || !isReady) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#04070d]/52 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/12 bg-[#07111c]/84 p-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.4)]">
            <div className="text-[0.72rem] uppercase tracking-[0.32em] text-white/45">
              Session Status
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{statusText}</h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              {getStatusDetail(statusText)}
            </p>
            {needsUserStart && (
              <button
                type="button"
                onClick={startVision}
                className="mt-6 rounded-full border border-[#8df5df]/35 bg-[#8df5df]/12 px-5 py-3 text-sm font-medium uppercase tracking-[0.18em] text-[#8df5df] transition hover:bg-[#8df5df]/18"
              >
                Start Camera
              </button>
            )}
          </div>
        </div>
      )}

      <section className="relative z-10 flex w-full max-w-6xl flex-col items-center px-6 py-12 md:px-10">
        <motion.div
          className="mb-6 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[0.72rem] uppercase tracking-[0.28em] text-white/65"
          animate={{
            opacity: visualEffectLevel === 'minimal' ? 0.84 : 1,
            scale: visualEffectLevel === 'full' ? 1.02 : 1,
          }}
          transition={UI_TRANSITION}
        >
          Buffered UI at 30 FPS max | Intent hold 150-250ms
        </motion.div>

        <div className={`relative w-full max-w-3xl overflow-hidden rounded-[2rem] border ${panelClass}`}>
          {particleCount > 0 &&
            PARTICLE_LAYOUT.slice(0, particleCount).map((particle, index) => (
              <motion.span
                key={`${particle.left}-${particle.top}-${index}`}
                className="absolute rounded-full bg-white/70"
                style={{
                  top: particle.top,
                  left: particle.left,
                  width: particle.size,
                  height: particle.size,
                }}
                animate={{
                  opacity: showGlow ? [0.1, 0.45, 0.15] : [0.05, 0.22, 0.08],
                  y: [-10, -35, -15],
                  x: [-5, 8, -2],
                  scale: [0.85, 1.05, 0.9],
                }}
                transition={{
                  duration: particle.duration * 1.2,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}

          <motion.div
            className={`absolute inset-x-[10%] top-[-18%] h-44 rounded-full bg-gradient-to-r ${intentMeta.accentClass} ${
              showAmbientBlur ? 'opacity-[0.26] blur-3xl' : 'opacity-[0.16] blur-2xl'
            }`}
            animate={{
              opacity: showGlow ? [0.16, 0.3, 0.2] : [0.08, 0.14, 0.1],
              scale: deferredIntent === Intent.CONNECT ? [1, 1.06, 1] : [1, 1.03, 1],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative z-10 flex min-h-[28rem] flex-col items-center justify-center px-8 py-12 text-center md:px-14">
            <motion.div
              className={`mb-6 rounded-full border px-4 py-2 text-[0.72rem] uppercase tracking-[0.28em] text-white/70 ${intentMeta.ringClass}`}
              animate={
                deferredIntent === Intent.CONNECT
                  ? { scale: [1, 1.05, 1], opacity: [0.72, 1, 0.72] }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              {intentMeta.eyebrow}
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={deferredIntent}
                initial={intentAnimation.initial}
                animate={intentAnimation.animate}
                exit={intentAnimation.exit}
                transition={UI_TRANSITION}
                className="flex flex-col items-center"
              >
                <div className="mb-4 text-[0.72rem] uppercase tracking-[0.42em] text-white/42">
                  Active Intent
                </div>

                <motion.h1
                  className={`bg-gradient-to-r ${intentMeta.accentClass} bg-clip-text text-5xl font-semibold tracking-[0.16em] text-transparent sm:text-7xl md:text-[5.4rem]`}
                  animate={
                    deferredIntent === Intent.CONNECT
                      ? { scale: [1, 1.02, 1] }
                      : deferredIntent === Intent.LAUNCH
                        ? { y: [0, -5, 0] }
                        : { scale: 1 }
                  }
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {deferredIntent}
                </motion.h1>

                <p className="mt-6 max-w-2xl text-sm leading-7 text-white/62 md:text-base">
                  {intentMeta.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-[0.72rem] uppercase tracking-[0.22em] text-white/48 md:px-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <span className="flex items-center gap-2"><span className="text-sm">👋</span> Discover</span>
              <span className="flex items-center gap-2"><span className="text-sm">✌️</span> Launch</span>
              <span className="flex items-center gap-2"><span className="text-sm">☝️</span> Connect</span>
              <span className="flex items-center gap-2"><span className="text-sm">✊</span> Dismiss</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Effects: {visualEffectLevel}</span>
              <span className="hidden sm:inline">Backpressure: Bounded</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
