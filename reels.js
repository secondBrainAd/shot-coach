// Approximate Reels layout guide. Generic shapes only, no brand marks.
// Zones are rough fractions of the 9:16 frame: check them against one of your own published reels.
export const ZONES = { top: 0.14, bottom: 0.25, right: 0.14 };

export function drawReelsLayout(ctx, W, H) {
  ctx.save();
  ctx.textBaseline = 'middle';
  // top bar
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, W, H * ZONES.top);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${Math.round(H * 0.028)}px system-ui, sans-serif`;
  ctx.fillText('Reels', W * 0.05, H * ZONES.top * 0.55);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W * 0.93, H * ZONES.top * 0.55, H * 0.016, 0, Math.PI * 2); ctx.stroke();
  // bottom caption area
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, H * (1 - ZONES.bottom), W, H * ZONES.bottom);
  ctx.beginPath(); ctx.arc(W * 0.08, H * 0.835, H * 0.02, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(W * 0.15, H * 0.828, W * 0.28, H * 0.012);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(W * 0.05, H * 0.875, W * 0.62, H * 0.01);
  ctx.fillRect(W * 0.05, H * 0.9, W * 0.5, H * 0.01);
  ctx.fillRect(W * 0.05, H * 0.94, W * 0.34, H * 0.01);
  // right action column
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(H * 0.034)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  [['♥', 0.55], ['○', 0.63], ['➤', 0.71], ['⋯', 0.79]].forEach(([g, y]) => ctx.fillText(g, W * (1 - ZONES.right / 2), H * y));
  ctx.restore();
}

// For explainer shots: marks the free space above the head where visuals go.
export function drawVisualsZone(ctx, W, H, crownY) {
  const top = H * ZONES.top, bottom = Math.max(0, crownY) * H - H * 0.01;
  if (bottom - top < H * 0.06) return;
  ctx.save();
  ctx.setLineDash([8, 6]); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
  ctx.strokeRect(W * 0.05, top + H * 0.01, W * 0.9, bottom - top - H * 0.01);
  ctx.fillStyle = '#60a5fa'; ctx.font = `600 ${Math.round(H * 0.022)}px system-ui, sans-serif`; ctx.textBaseline = 'top';
  ctx.fillText('visuals here', W * 0.08, top + H * 0.02);
  ctx.restore();
}
