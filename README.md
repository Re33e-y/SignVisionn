# SignVisionn

Browser-based sign language recognition — real-time ASL alphabet detection running fully in the browser, no server inference.

## What it does
- Detects hand landmarks via MediaPipe
- Recognizes ASL alphabet letters using an EfficientNetB0 model
- Runs inference locally in the browser with ONNX Runtime Web (webcam frames never leave the device)
- Smooths gesture output with One Euro filtering + 5-frame consistency checks before appending letters

## Architecture
- Dual pipeline: separate vision pipeline + ASL recognition pipeline
- 3 Web Workers: vision, compositing, ASL inference
- Device profiling with 3 performance tiers (battery-aware)
- Frame transfer via `requestAnimationFrame` with worker-busy backpressure

## Results
- Validation accuracy: ~90.8% on a 29-class ASL alphabet baseline *(early experiment; final model: [FILL IN or remove])*
- Inference: ~36 FPS measured on an 8th-gen i7 laptop *(target: 60 FPS)*
- Model: EfficientNetB0, converted to ONNX
- Training: [trained by me / fine-tuned from a pretrained checkpoint / integrated a pretrained model]

## Key files
- `src/app/components/DualPipelineVisionEngine.tsx` — main pipeline
- `src/app/hooks/useDualVision.ts` — vision hook
- `src/app/workers/workerSource.ts` — worker logic
- `src/lib/utils/deviceProfiler.ts` — device tiering

## What I'd do differently
- Use a pretrained model instead of training from scratch
- Research latency-reducing tech before committing to an architecture
- Explore a 3D interface for the UX

## Stack
Next.js · TypeScript · MediaPipe · ONNX Runtime Web · EfficientNetB0
