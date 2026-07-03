import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

let recognizer: GestureRecognizer | null = null;
let isInitializing = false;

async function initRecognizer(modelUrl: string) {
  if (isInitializing || recognizer) return;
  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1, // Focus on primary hand for performance
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    self.postMessage({ type: 'READY' });
  } catch (error) {
    console.error("Worker Init Error: ", error);
    self.postMessage({ type: 'ERROR', error: String(error) });
  } finally {
    isInitializing = false;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  
  if (data.type === 'INIT') {
    initRecognizer(data.modelUrl);
    return;
  }

  if (!recognizer) {
    // If we receive a frame before initialization, drop it and close bitmap if present
    if (data.bitmap) data.bitmap.close();
    return;
  }

  const start = performance.now();
  let gestureName: string | null = null;
  let confidence = 0;

  try {
    // Process frame depending on what was sent
    const source = data.bitmap || data.imageData;
    if (source) {
      const results = recognizer.recognizeForVideo(source, data.timestamp);
      const hasLandmarks = Boolean(
        results &&
          results.landmarks &&
          results.landmarks.length > 0 &&
          results.landmarks[0]?.length > 0,
      );

      if (
        hasLandmarks &&
        results &&
        results.gestures &&
        results.gestures.length > 0 &&
        (results.gestures[0][0]?.score || 0) >= 0.5
      ) {
        // Return top gesture
        gestureName = results.gestures[0][0]?.categoryName || 'None';
        confidence = results.gestures[0][0]?.score || 0;
      } else {
        gestureName = 'None';
        confidence = 0;
      }
    }
  } catch (error) {
    console.error("Worker Inference Error: ", error);
  } finally {
    const processingTime = performance.now() - start;
    self.postMessage({
      type: 'RESULT',
      gesture: gestureName,
      confidence,
      timestamp: data.timestamp,
      processingTime
    });

    // Cleanup resources
    if (data.bitmap) {
      data.bitmap.close();
    }
  }
};
