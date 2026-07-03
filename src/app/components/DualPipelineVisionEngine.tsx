'use client';

import React from 'react';
import { useDualVision } from '../hooks/useDualVision';

export default function DualPipelineVisionEngine() {
  const { 
    videoRef, canvasRef, isReady, fps, processingTime, tier, battery, cameraError, 
    aslResult, aslWord, isAslReady, captureFrame
  } = useDualVision();

  const [lastCaptured, setLastCaptured] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handler = (e: any) => {
      setLastCaptured(`${e.detail.label} saved!`);
      setTimeout(() => setLastCaptured(null), 4000);
    };
    window.addEventListener('frame-saved', handler);
    return () => window.removeEventListener('frame-saved', handler);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#010204] overflow-hidden font-mono antialiased">
        {/* CSS Variables for Dynamic Theming */}
        <style jsx global>{`
          :root {
            --neon-primary: #39FF14;
            --neon-secondary: #00FFFF;
            --neon-alert: #FF3131;
            --neon-accent: #FF00FF;
          }
          @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
        `}</style>
        
      {/* 1. The AR Canvas (Offscreen Driven) */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full h-full max-h-screen object-contain pointer-events-none scale-110"
      />

      {/* 2. Hidden Source */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {/* 3. Elite HUD HUD */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between selection:bg-neon-primary/30">
        
        {/* TOP STATUS BAR */}
        <div className="flex justify-between items-start">
            <div className="bg-[#07111c]/80 border-l-2 border-neon-primary p-4 rounded-r-2xl backdrop-blur-xl shadow-[0_0_40px_rgba(57,255,20,0.1)]">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-neon-primary animate-pulse" />
                    <h1 className="text-xl font-black tracking-tighter text-white">
                        ANTIGRAVITY <span className="text-neon-primary">v2.1</span>
                    </h1>
                </div>
                <div className="flex gap-4 mt-2 text-[0.6rem] uppercase tracking-[0.3em] font-bold">
                    <span className={tier === 1 ? 'text-neon-primary' : 'text-white/40'}>Tier_01</span>
                    <span className={tier === 2 ? 'text-neon-secondary' : 'text-white/40'}>Tier_02</span>
                    <span className={tier === 3 ? 'text-neon-alert' : 'text-white/40'}>Tier_03</span>
                </div>
            </div>

            <div className="bg-[#07111c]/60 border border-white/5 p-4 rounded-2xl backdrop-blur-md text-right">
                <div className="text-[0.6rem] uppercase tracking-widest text-white/40 mb-1">Battery Monitoring</div>
                <div className="flex items-center justify-end gap-3">
                    <span className={`text-sm font-bold ${battery.level < 0.2 ? 'text-neon-alert' : 'text-neon-primary'}`}>
                        {Math.round(battery.level * 100)}%
                    </span>
                    <div className="w-12 h-4 border border-white/20 p-0.5 rounded-sm relative">
                        <div 
                            className={`h-full transition-all duration-1000 ${battery.level < 0.2 ? 'bg-neon-alert' : 'bg-neon-primary'}`} 
                            style={{ width: `${battery.level * 100}%` }}
                        />
                        {battery.charging && <div className="absolute -right-5 top-1/2 -translate-y-1/2 text-neon-secondary text-[0.5rem]">⚡</div>}
                    </div>
                </div>
            </div>
        </div>

        {/* DIAGNOSTICS & VERIFICATION PANEL */}
        <div className="absolute left-6 top-32 w-56 flex flex-col gap-4 pointer-events-auto">
             <div className="bg-[#07111c]/80 border-l-2 border-neon-accent p-4 rounded-r-2xl backdrop-blur-xl relative overflow-hidden shadow-[0_0_30px_rgba(255,0,255,0.05)]">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30 mb-2">Webcam_Diagnostics</div>
                <div className="text-[0.7rem] text-white/80 mb-3 font-sans leading-relaxed">
                  Capture exact 224x224 crop/resize tensors right before inference.
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    {['A', 'B', 'C', 'L', 'Y'].map((letter) => (
                      <button
                        key={letter}
                        onClick={() => captureFrame?.(`real_hand_${letter}`)}
                        className="py-1 px-2 bg-black/40 border border-neon-secondary/20 hover:border-neon-secondary hover:bg-neon-secondary/10 text-neon-secondary hover:text-white rounded text-xs font-bold transition-all duration-200 active:scale-95"
                      >
                        Cap {letter}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => captureFrame?.('background')}
                    className="w-full py-1.5 px-3 bg-black/40 border border-neon-accent/20 hover:border-neon-accent hover:bg-neon-accent/10 text-neon-accent hover:text-white rounded text-xs font-bold transition-all duration-200 active:scale-95 uppercase tracking-widest"
                  >
                    Capture Background
                  </button>
                </div>

                {lastCaptured && (
                  <div className="mt-3 p-2 bg-black/60 border border-neon-primary/20 rounded text-[0.6rem] text-neon-primary animate-pulse font-bold uppercase break-all leading-normal">
                    {lastCaptured}
                  </div>
                )}
             </div>
        </div>

        {/* CENTER LOADING / ERROR */}
        {!isReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-neon-primary/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-neon-primary rounded-full animate-spin" />
                    </div>
                    <div className="text-neon-primary text-[0.7rem] uppercase tracking-[0.5em] animate-pulse">Syncing Dual Pipelines...</div>
                </div>
            </div>
        )}

        {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50">
                <div className="text-neon-alert text-2xl font-black mb-4 animate-pulse uppercase tracking-widest">Camera Access Denied</div>
                <div className="text-white/80 text-sm max-w-md text-center border border-white/10 p-6 rounded-2xl bg-[#07111c]/80 shadow-[0_0_30px_rgba(255,49,49,0.15)]">
                    <p className="mb-3 font-mono opacity-60 text-xs">{cameraError}</p>
                    <p className="font-bold text-white">Please authorize Camera permissions in your browser (click the lock or Shield icon next to your URL bar) and hit Refresh.</p>
                </div>
            </div>
        )}

        {/* BOTTOM TELEMETRY GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[#07111c]/60 border border-white/10 rounded-2xl backdrop-blur-xl">
             <div className="border-r border-white/5 pr-4">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">Pipeline_Throughput</div>
                <div className="text-2xl font-black text-white/90">{fps}<span className="text-[0.6rem] ml-1 text-neon-primary">FPS</span></div>
             </div>
             <div className="border-r border-white/5 pr-4">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">Inference_Compute</div>
                <div className="text-2xl font-black text-white/90">{processingTime.toFixed(1)}<span className="text-[0.6rem] ml-1 text-neon-secondary">MS</span></div>
             </div>
             <div className="border-r border-white/5 pr-4">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">Governor_Profile</div>
                <div className="text-2xl font-black text-white/90">LOD_{tier}</div>
             </div>
             <div className="border-r border-white/5 pr-4">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">Vision_System</div>
                <div className={`text-2xl font-black ${isReady ? 'text-neon-secondary' : 'text-neon-alert'}`}>
                    {isReady ? 'READY' : 'STALLED'}
                </div>
             </div>
             <div className="border-r border-white/5 pr-4">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">ASL_System</div>
                <div className={`text-2xl font-black ${isAslReady ? 'text-neon-primary' : 'text-neon-alert'}`}>
                    {isAslReady ? 'ONLINE' : 'BOOTING'}
                </div>
             </div>
             <div>
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30">System_Status</div>
                <div className="text-2xl font-black text-white/90">{battery.level < 0.2 ? 'THROTTLED' : 'NOMINAL'}</div>
             </div>
        </div>

        {/* ASL DECODER HUD PANEL */}
        <div className="absolute right-6 top-32 w-48 flex flex-col gap-4">
             <div className="bg-[#07111c]/80 border-r-2 border-neon-secondary p-4 rounded-l-2xl backdrop-blur-xl text-right relative overflow-hidden">
                {/* Scanner effect */}
                <div className="absolute top-0 right-0 w-1 h-full bg-neon-secondary opacity-20 animate-[scan_2s_linear_infinite]" />
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30 mb-2">ASL_Decoder_Live</div>
                <div className="text-6xl font-black text-neon-secondary mb-1 drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]">
                    {aslResult?.confidence >= 0.75 ? aslResult.letter : '—'}
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-neon-secondary transition-all duration-300"
                        style={{ width: `${Math.round((aslResult?.confidence || 0) * 100)}%` }}
                    />
                </div>
             </div>

             <div className="bg-[#07111c]/60 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                <div className="text-[0.5rem] uppercase tracking-widest text-white/30 mb-2">ASL_Log_History</div>
                <div className="text-xs font-bold text-white/80 tracking-widest bg-black/40 p-3 rounded border border-white/5 min-h-[50px] break-all leading-relaxed uppercase shadow-inner">
                    {aslWord || 'START_SIGNING...'}
                </div>
             </div>
        </div>

      </div>
    </main>
  );
}
