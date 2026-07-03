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

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [0, 9], [9, 10], [10, 11], [11, 12], // middle
  [0, 13], [13, 14], [14, 15], [15, 16], // ring
  [0, 17], [17, 18], [18, 19], [19, 20] // pinky
];

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  gesture: GestureType,
  width: number,
  height: number
) {
  if (!landmarks || landmarks.length === 0) return;

  const points = landmarks.map(p => ({
    x: p.x * width,
    y: p.y * height
  }));

  // 1. Draw Bounding Box (YOLO Style)
  const minX = Math.min(...points.map(p => p.x)) - 20;
  const maxX = Math.max(...points.map(p => p.x)) + 20;
  const minY = Math.min(...points.map(p => p.y)) - 20;
  const maxY = Math.max(...points.map(p => p.y)) + 20;

  ctx.save();
  ctx.strokeStyle = gesture === 'OPEN_PALM' ? '#FF3131' : '#39FF14';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = ctx.strokeStyle;
  
  // Pulsing effect for Thumbs Up
  if (gesture === 'THUMBS_UP') {
    const pulse = Math.sin(Date.now() / 200) * 5;
    ctx.shadowBlur = 15 + pulse;
  }

  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
  
  // Label Tag
  ctx.fillStyle = ctx.strokeStyle;
  ctx.shadowBlur = 0;
  ctx.font = 'bold 12px "Segoe UI Variable Display", sans-serif';
  ctx.fillRect(minX, minY - 24, 80, 24);
  ctx.fillStyle = '#000';
  ctx.fillText(gesture.replace('_', ' '), minX + 8, minY - 8);
  ctx.restore();

  // 2. Draw Skeleton
  ctx.save();
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#00FFFF';
  
  HAND_CONNECTIONS.forEach(([i, j]) => {
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[j].x, points[j].y);
    ctx.stroke();
  });
  ctx.restore();

  // 3. Draw Landmark Points
  ctx.save();
  ctx.fillStyle = '#00FFFF';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00FFFF';
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 4. Gesture-Specific Visual Effects
  drawGestureEffects(ctx, points, gesture);
}

function drawGestureEffects(ctx: CanvasRenderingContext2D, points: {x: number, y: number}[], gesture: GestureType) {
  ctx.save();

  switch (gesture) {
    case 'PEACE': {
      // Neon "V" from wrist to tips
      ctx.strokeStyle = '#FF00FF';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF00FF';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[8].x, points[8].y);
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[12].x, points[12].y);
      ctx.stroke();
      break;
    }
    case 'POINT': {
      // Neon vector + target reticle
      const tip = points[8];
      const base = points[5];
      const dx = tip.x - base.x;
      const dy = tip.y - base.y;
      
      ctx.strokeStyle = '#39FF14';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + dx * 2, tip.y + dy * 2);
      ctx.stroke();
      
      // Reticle
      ctx.beginPath();
      ctx.arc(tip.x + dx * 2, tip.y + dy * 2, 15, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'OK': {
      // Glowing circle at pinch point
      const pinchX = (points[4].x + points[8].x) / 2;
      const pinchY = (points[4].y + points[8].y) / 2;
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#00FFFF';
      ctx.beginPath();
      ctx.arc(pinchX, pinchY, 20, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'ROCK': {
      // Horn neon spikes
      ctx.strokeStyle = '#FF3131';
      ctx.lineWidth = 5;
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#FF3131';
      ctx.beginPath();
      ctx.moveTo(points[8].x, points[8].y);
      ctx.lineTo(points[8].x, points[8].y - 40);
      ctx.moveTo(points[20].x, points[20].y);
      ctx.lineTo(points[20].x, points[20].y - 40);
      ctx.stroke();
      break;
    }
    case 'THUMBS_UP': {
      // Upward neon arrow
      ctx.strokeStyle = '#39FF14';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[4].x, points[4].y);
      ctx.stroke();
      break;
    }
    case 'FIST': {
      // Central glowing dot
      const centerX = points[9].x;
      const centerY = points[9].y;
      ctx.fillStyle = '#FFF';
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#FFF';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}
