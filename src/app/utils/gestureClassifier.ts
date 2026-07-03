export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export type GestureType = 
  | 'PEACE' 
  | 'OPEN_PALM' 
  | 'FIST' 
  | 'POINT' 
  | 'THUMBS_UP' 
  | 'OK' 
  | 'ROCK' 
  | 'SWIPE' 
  | 'NONE';

interface SwipeState {
  lastX: number;
  lastTime: number;
  velocity: number;
}

const swipeState: SwipeState = { lastX: 0, lastTime: 0, velocity: 0 };

export function classifyGesture(landmarks: Landmark[]): GestureType {
  if (!landmarks || landmarks.length < 21) return 'NONE';

  const fingerStates = getFingerStates(landmarks);
  const { thumb, index, middle, ring, pinky } = fingerStates;

  // 1. SWIPE (Dynamic)
  const wrist = landmarks[0];
  const now = performance.now();
  if (swipeState.lastTime > 0) {
    const dt = now - swipeState.lastTime;
    const dx = wrist.x - swipeState.lastX;
    swipeState.velocity = (dx / dt) * 1000; // units per second
  }
  swipeState.lastX = wrist.x;
  swipeState.lastTime = now;

  if (Math.abs(swipeState.velocity) > 0.8) return 'SWIPE';

  // 2. PEACE (Index + Middle)
  if (index && middle && !ring && !pinky && !thumb) return 'PEACE';

  // 3. THUMBS_UP
  // Thumb tip (4) above thumb IP (3) + others closed
  const thumbUp = landmarks[4].y < landmarks[3].y && !index && !middle && !ring && !pinky;
  if (thumbUp) return 'THUMBS_UP';

  // 4. OK SIGN
  // Distance 4 to 8 < 0.05 + others extended
  const dist4to8 = getDist(landmarks[4], landmarks[8]);
  if (dist4to8 < 0.05 && middle && ring && pinky) return 'OK';

  // 5. ROCK SIGN (Index + Pinky)
  if (index && pinky && !middle && !ring) return 'ROCK';

  // 6. POINT (Only Index)
  if (index && !middle && !ring && !pinky) return 'POINT';

  // 7. OPEN_PALM (All open)
  if (index && middle && ring && pinky && thumb) return 'OPEN_PALM';

  // 8. FIST (All closed)
  if (!index && !middle && !ring && !pinky && !thumb) return 'FIST';

  return 'NONE';
}

function getFingerStates(landmarks: Landmark[]) {
  // Finger is "open" if tip is further from wrist than the base PIP joint
  return {
    thumb: isThumbOpen(landmarks),
    index: isFingerOpen(landmarks, 8, 6),
    middle: isFingerOpen(landmarks, 12, 10),
    ring: isFingerOpen(landmarks, 16, 14),
    pinky: isFingerOpen(landmarks, 20, 18),
  };
}

function isFingerOpen(landmarks: Landmark[], tipIdx: number, baseIdx: number): boolean {
  // Simple Y-axis check for vertical hands, but more robust is distance from wrist (0)
  const distTip = getDist(landmarks[0], landmarks[tipIdx]);
  const distBase = getDist(landmarks[0], landmarks[baseIdx]);
  return distTip > distBase;
}

function isThumbOpen(landmarks: Landmark[]): boolean {
  // Thumb is horizontal/side usually, check X distance from landmark 2
  const distTip = getDist(landmarks[0], landmarks[4]);
  const distBase = getDist(landmarks[0], landmarks[2]);
  return distTip > distBase * 1.2;
}

function getDist(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
