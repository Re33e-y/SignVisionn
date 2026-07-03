/**
 * ELITE_WORKER_SOURCES (Nuclear Bypass)
 * Inlined to guarantee Classic Worker status and stable module loading.
 */

export const VISION_WORKER_SOURCE = `
    self.importScripts(location.origin + "/mediapipe_bundle.js");
    const { HandLandmarker, ImageSegmenter, FilesetResolver } = self.tasksVision;

    class LowPassFilter {
        constructor(alpha) { this.y = null; this.alpha = alpha; }
        filter(value) {
            if (this.y === null) this.y = value;
            else this.y = this.alpha * value + (1 - this.alpha) * this.y;
            return this.y;
        }
        setAlpha(alpha) { this.alpha = alpha; }
    }

    class OneEuroFilter {
        constructor(freq, minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
            this.freq = freq; this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
            this.xFilter = new LowPassFilter(this.alpha(minCutoff));
            this.dxFilter = new LowPassFilter(this.alpha(dCutoff));
            this.lastTime = null;
        }
        alpha(cutoff) { const tau = 1.0 / (2 * Math.PI * cutoff); return 1.0 / (1.0 + tau / (1.0 / this.freq)); }
        filter(value, timestamp) {
            if (this.lastTime !== null && timestamp > this.lastTime) { 
                const te = (timestamp - this.lastTime) / 1000; 
                if (te > 0) this.freq = 1.0 / te; 
            }
            this.lastTime = timestamp;
            const dx = this.dxFilter.filter((value - (this.xFilter.filter(value) || value)) * this.freq);
            const cutoff = this.minCutoff + this.beta * Math.abs(dx);
            this.xFilter.setAlpha(this.alpha(cutoff));
            return this.xFilter.filter(value);
        }
    }

    const CONFIG = { TARGET_FPS: 60, SEGMENTATION_INTERVAL: 6 };
    let handLandmarker = null, imageSegmenter = null, isInitializing = false;
    let frameCount = 0;
    const filters = Array.from({ length: 42 }, () => new OneEuroFilter(60, 1.0, 0.007, 1.0));

    async function initModels() {
        if (isInitializing || (handLandmarker && imageSegmenter)) return;
        isInitializing = true;
        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task", delegate: "CPU" },
                runningMode: "VIDEO", numHands: 2
            });
            imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite", delegate: "CPU" },
                runningMode: "VIDEO", outputCategoryMask: true
            });
            self.postMessage({ type: 'READY' });
        } catch (error) { 
            console.error("Nuclear Worker Error:", error);
            self.postMessage({ type: 'ERROR', error: String(error) }); 
        } finally { isInitializing = false; }
    }

    self.onmessage = async (e) => {
        const data = e.data;
        if (data.type === 'INIT') { initModels(); return; }
        if (data.type === 'BATTERY') { return; }
        if (data.type === 'PROCESS') {
            if (!handLandmarker || !imageSegmenter) {
                if (data.bitmap) data.bitmap.close();
                return;
            }
            const start = performance.now();
            const { bitmap, timestamp, skipSegmentation } = data;
            frameCount++;
            try {
                const runSegmentation = !skipSegmentation && (frameCount % CONFIG.SEGMENTATION_INTERVAL === 0);
                let mask = null;
                if (runSegmentation) {
                    const segResult = imageSegmenter.segmentForVideo(bitmap, timestamp);
                    mask = segResult.categoryMask?.getAsUint8Array() || null;
                }
                const handResult = handLandmarker.detectForVideo(bitmap, timestamp);
                const smoothedLandmarks = handResult.landmarks.map(hand => {
                    return hand.map((p, i) => ({
                        x: filters[i * 2].filter(p.x, timestamp),
                        y: filters[i * 2 + 1].filter(p.y, timestamp),
                        z: p.z
                    }));
                });
                self.postMessage({ 
                    type: 'RESULT', 
                    frame: bitmap, 
                    landmarks: smoothedLandmarks, 
                    mask: mask, 
                    timestamp, 
                    processingTime: performance.now() - start 
                }, [bitmap]);
            } catch (error) { 
                console.error("Nuclear Inference Error:", error); 
                if (bitmap) bitmap.close();
            }
        }
    };
`;

export const COMPOSITOR_WORKER_SOURCE = `
    const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20]];

    function getDist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }
    function isFingerOpen(landmarks, tipIdx, baseIdx) { return getDist(landmarks[0], landmarks[tipIdx]) > getDist(landmarks[0], landmarks[baseIdx]); }
    function classifyGesture(landmarks) {
        if (!landmarks || landmarks.length < 21) return 'NONE';
        const states = {
            thumb: getDist(landmarks[0], landmarks[4]) > getDist(landmarks[0], landmarks[2]) * 1.2,
            index: isFingerOpen(landmarks, 8, 6), middle: isFingerOpen(landmarks, 12, 10),
            ring: isFingerOpen(landmarks, 16, 14), pinky: isFingerOpen(landmarks, 20, 18)
        };
        if (states.index && states.middle && !states.ring && !states.pinky) return 'PEACE';
        if (landmarks[4].y < landmarks[3].y && !states.index && !states.middle && !states.ring && !states.pinky) return 'THUMBS_UP';
        if (states.index && states.pinky && !states.middle && !states.ring) return 'ROCK';
        if (states.index && states.middle && states.ring && states.pinky && states.thumb) return 'OPEN_PALM';
        if (!states.index && !states.middle && !states.ring && !states.pinky) return 'FIST';
        return 'NONE';
    }

    function drawHandOverlay(ctx, landmarks, gesture, width, height) {
        if (!landmarks) return;
        const points = landmarks.map(p => ({ x: p.x * width, y: p.y * height }));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let k = 0; k < points.length; k++) {
            if (points[k].x < minX) minX = points[k].x;
            if (points[k].x > maxX) maxX = points[k].x;
            if (points[k].y < minY) minY = points[k].y;
            if (points[k].y > maxY) maxY = points[k].y;
        }
        minX -= 20; maxX += 20; minY -= 20; maxY += 20;
        
        ctx.save();
        ctx.strokeStyle = gesture === 'OPEN_PALM' ? '#FF3131' : '#39FF14'; 
        ctx.lineWidth = 2; 
        ctx.shadowBlur = 15; 
        ctx.shadowColor = ctx.strokeStyle;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        
        ctx.fillStyle = ctx.strokeStyle; ctx.shadowBlur = 0; 
        ctx.fillRect(minX, minY - 24, 80, 24);
        ctx.font = "bold 12px monospace"; ctx.fillStyle = '#000'; 
        ctx.fillText(gesture, minX + 8, minY - 8);
        ctx.restore(); 

        ctx.save(); 
        ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#00FFFF';
        HAND_CONNECTIONS.forEach(([i, j]) => { 
            ctx.beginPath(); ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[j].x, points[j].y); ctx.stroke(); 
        });
        ctx.restore();
    }

    let canvas = null, ctx = null, backBuffer = null, backCtx = null;
    let maskCanvas = null, maskCtx = null;
    let lastLandmarks = null, lastMask = null, lastMaskImageData = null;
    let lastAsl = { letter: '', confidence: 0 };

    self.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'INIT') {
            canvas = data.canvas;
            ctx = canvas?.getContext('2d');
            if (canvas) {
                backBuffer = new OffscreenCanvas(canvas.width, canvas.height);
                backCtx = backBuffer.getContext('2d');
                // Dedicated mask canvas at model native resolution (256x256)
                maskCanvas = new OffscreenCanvas(256, 256);
                maskCtx = maskCanvas.getContext('2d');
            }
            return;
        }
        if (data.type === 'SET_ASL') {
            lastAsl = { letter: data.letter, confidence: data.confidence };
            return;
        }
        if (data.type === 'RENDER') {
            if (!ctx || !backCtx || !canvas) return;
            const { frame, landmarks, mask, isDirect } = data;
            
            if (landmarks !== undefined) lastLandmarks = landmarks;
            if (mask !== undefined) lastMask = mask;

            // Clear back buffer
            backCtx.fillStyle = '#000000';
            backCtx.fillRect(0, 0, canvas.width, canvas.height);

            if (frame) {
                backCtx.drawImage(frame, 0, 0, canvas.width, canvas.height);

                if (lastMask && maskCtx && !isDirect) {
                    // Only rebuild mask ImageData when the mask has changed
                    if (lastMaskImageData === null || lastMaskImageData._mask !== lastMask) {
                        const md = maskCtx.createImageData(256, 256);
                        for (let i = 0; i < lastMask.length; i++) {
                            // person classes: 1=hair,2=body,3=face,4=clothes,5=others — keep all non-zero
                            md.data[i * 4 + 3] = lastMask[i] !== 0 ? 255 : 0;
                        }
                        maskCtx.putImageData(md, 0, 0);
                        lastMaskImageData = md;
                        lastMaskImageData._mask = lastMask;
                    }
                    // GPU composite: keep only pixels where mask is opaque (person)
                    backCtx.globalCompositeOperation = 'destination-in';
                    backCtx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
                    backCtx.globalCompositeOperation = 'source-over';

                    // Fill background behind the person
                    backCtx.globalCompositeOperation = 'destination-over';
                    backCtx.fillStyle = '#010204';
                    backCtx.fillRect(0, 0, canvas.width, canvas.height);
                    backCtx.globalCompositeOperation = 'source-over';
                }
            }

            if (lastLandmarks) {
                lastLandmarks.forEach(hand => {
                    const gesture = classifyGesture(hand);
                    drawHandOverlay(backCtx, hand, gesture, canvas.width, canvas.height);
                });
            }

            // Draw ASL Prediction Overlay
            if (lastAsl.letter && lastAsl.letter !== 'nothing' && lastAsl.confidence >= 0.75) {
                backCtx.save();
                backCtx.font = "bold 120px monospace";
                backCtx.fillStyle = '#39FF14';
                backCtx.shadowBlur = 20;
                backCtx.shadowColor = '#39FF14';
                backCtx.textAlign = 'right';
                // Draw high on the right side
                backCtx.fillText(lastAsl.letter, canvas.width - 40, 140);
                
                // Confidence bar
                backCtx.fillStyle = '#1a1a1a';
                backCtx.fillRect(canvas.width - 240, 160, 200, 10);
                backCtx.fillStyle = '#39FF14';
                backCtx.fillRect(canvas.width - 240, 160, 200 * lastAsl.confidence, 10);
                backCtx.font = "bold 12px monospace";
                backCtx.fillText('CONFIDENCE: ' + Math.round(lastAsl.confidence * 100) + '%', canvas.width - 40, 190);
                backCtx.restore();
            }

            // Flip back buffer to screen
            ctx.drawImage(backBuffer, 0, 0);
            if (frame) frame.close();
        }
    };
`;

export const ASL_WORKER_SOURCE = `
    self.importScripts("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js");
    
    let session = null;
    let isBusy = false;
    const ASL_CLASSES = [
      'A','B','C','D','E','F','G','H','I',
      'K','L','M','N','O','P','Q','R','S','T',
      'U','V','W','X','Y'
    ];

    async function init() {
        try {
            // Use CDN for WASM binaries since we don't have them locally
            ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
            
            session = await ort.InferenceSession.create(location.origin + "/models/asl_model.onnx", {
                executionProviders: ['webgl'],
                graphOptimizationLevel: 'all'
            });
            console.log("INPUTS:", session.inputNames);
            console.log("OUTPUTS:", session.outputNames);
            self.postMessage({ type: 'READY' });
        } catch (e) {
            console.error("ASL Worker WebGL Fail, falling back to WASM:", e);
            try {
                session = await ort.InferenceSession.create(location.origin + "/models/asl_model.onnx", {
                    executionProviders: ['wasm']
                });
                console.log("INPUTS fallback:", session.inputNames);
                console.log("OUTPUTS fallback:", session.outputNames);
                self.postMessage({ type: 'READY' });
            } catch (e2) {
                console.error("ASL Worker Critical Failure:", e2);
                self.postMessage({ type: 'ERROR', message: e2.message });
            }
        }
    }

    self.onmessage = async (e) => {
        const data = e.data;
        if (data.type === 'INIT') { init(); return; }
        if (data.type === 'CLASSIFY') {
            if (!session || isBusy) {
                if (data.bitmap) data.bitmap.close();
                return;
            }
            isBusy = true;
            try {
                const t0 = performance.now();
                const { bitmap } = data;
                // Note: Bitmap is already 224x224 from the hook resize logic
                const canvas = new OffscreenCanvas(224, 224);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
                bitmap.close();

                const imageData = ctx.getImageData(0, 0, 224, 224);
                const { data: pixels } = imageData;
                
                const input = new Float32Array(224 * 224 * 3);
                for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
                    input[j]     = pixels[i];     // R (0-255)
                    input[j + 1] = pixels[i + 1]; // G (0-255)
                    input[j + 2] = pixels[i + 2]; // B (0-255)
                }
                const t1 = performance.now();

                // Model is now fixed to static batch dimension [1, 224, 224, 3]
                const feeds = {};
                feeds['input'] = new ort.Tensor('float32', input, [1, 224, 224, 3]);
                
                // Feed normalization layer constants expected by the model inputs
                for (const name of session.inputNames) {
                    if (name !== 'input' && !feeds[name]) {
                        if (name.includes('Sub')) {
                            feeds[name] = new ort.Tensor('float32', new Float32Array([0.485, 0.456, 0.406]), [1, 1, 1, 3]);
                        } else if (name.includes('Sqrt') || name.includes('div') || name.includes('normalization')) {
                            feeds[name] = new ort.Tensor('float32', new Float32Array([0.229, 0.224, 0.225]), [1, 1, 1, 3]);
                        } else {
                            feeds[name] = new ort.Tensor('float32', new Float32Array([0.0, 0.0, 0.0]), [1, 1, 1, 3]);
                        }
                    }
                }
                const t2 = performance.now();
                const results = await session.run(feeds);
                const t3 = performance.now();
                
                const outputKey = session.outputNames[0];
                const scores = results[outputKey].data;
                
                // DEBUG — remove after confirming
                console.log('ASL scores length:', scores.length, 'maxScore:', Math.max(...scores).toFixed(3), 'maxIdx:', [...scores].indexOf(Math.max(...scores)));
                
                let maxIdx = 0;
                let maxScore = -1;
                for (let i = 0; i < scores.length; i++) {
                    if (scores[i] > maxScore) {
                        maxScore = scores[i];
                        maxIdx = i;
                    }
                }
                const t4 = performance.now();

                console.log("[ASL Profiling] Preprocess: " + (t1 - t0).toFixed(1) + "ms | TensorSetup: " + (t2 - t1).toFixed(1) + "ms | Inference: " + (t3 - t2).toFixed(1) + "ms | Postprocess: " + (t4 - t3).toFixed(1) + "ms | Total: " + (t4 - t0).toFixed(1) + "ms");

                self.postMessage({
                    type: 'RESULT',
                    letter: ASL_CLASSES[maxIdx] ?? '?',
                    confidence: maxScore,
                    timestamp: data.timestamp
                });
            } catch (err) {
                console.error("ASL Inference Error:", err);
                self.postMessage({ type: 'ERROR', message: String(err) });
            } finally {
                isBusy = false;
            }
        }
    };
`;
