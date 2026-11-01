// Shot Coach logic. Pure functions only, so Node can test them without a browser.

// Eye line and head size are fractions of the 9:16 frame height. Eyes 50% = middle of the frame.
export const PRESETS = {
  explainer: { key: 'explainer', label: 'Explainer', eyeLine: [0.47, 0.53], headHeight: [0.20, 0.36],
    note: 'Eyes in the middle, so the top third stays free for visuals.' },
  talking: { key: 'talking', label: 'Talking head', eyeLine: [0.35, 0.41], headHeight: [0.28, 0.46],
    note: 'Eyes on the upper third line, a closer and more personal shot.' },
  body: { key: 'body', label: 'Body shot', eyeLine: [0.26, 0.33], headHeight: [0.14, 0.24],
    note: 'Waist up, eyes high so your hands and gestures fit.' },
  full: { key: 'full', label: 'Full body', eyeLine: [0.17, 0.24], headHeight: [0.06, 0.13],
    note: 'Head to feet, eyes near the top. Face tracking is least reliable at this size.' },
};
export const TARGET = { centerTolerance: 0.07 }; // allowed horizontal offset of the face from the frame center
export const DRIFT = { eyeY: 0.025, size: 0.15, offset: 0.06 }; // how far a locked shot may move before a warning

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ramp = (v, lo, hi) => clamp01((v - lo) / (hi - lo));
const band = (v, a, b, c, d) => {
  if (v <= a || v >= d) return 0;
  if (v < b) return (v - a) / (b - a);
  if (v <= c) return 1;
  return (d - v) / (d - c);
};

// lm: FaceLandmarker landmarks, normalized 0..1. 10 = top of forehead, 152 = chin, 234/454 = cheeks,
// 468/473 = iris centers (eyes).
export function measureFraming(lm) {
  const top = lm[10], chin = lm[152], left = lm[234], right = lm[454];
  const eyeY = lm[468] && lm[473]
    ? (lm[468].y + lm[473].y) / 2
    : (lm[159].y + lm[145].y + lm[386].y + lm[374].y) / 4;
  const hairToChin = chin.y - top.y;
  const crownY = top.y - 0.28 * hairToChin; // estimate where the hair ends
  const headHeight = chin.y - crownY;
  const centerX = (left.x + right.x) / 2;
  const clipped = crownY < 0 || left.x < 0 || right.x > 1 || chin.y > 1;
  return { eyeY, headroom: crownY, headHeight, offset: centerX - 0.5, clipped };
}

// Frames come straight from the camera, not mirrored. A face on the right half of the raw
// image means the person stands to their own left of center, so they should move to their right.
export function framingVerdict(m, preset = PRESETS.explainer) {
  if (!m) return { ok: false, key: 'noface', short: 'Find the frame', say: "I can't see your face. Step into the frame and look at the lens." };
  const [eLo, eHi] = preset.eyeLine;
  const [hhLo, hhHi] = preset.headHeight;
  const name = preset.label.toLowerCase();
  if (m.headHeight > hhHi) return { ok: false, key: 'toobig', short: 'Step back', say: `Step back a little. You are too close for a ${name} shot.` };
  if (m.headHeight < hhLo) return { ok: false, key: 'toosmall', short: 'Come closer', say: `Move a little closer. You are too far for a ${name} shot.` };
  if (m.eyeY < eLo) return { ok: false, key: 'eyeshigh', short: 'Tilt up', say: `Your eyes are too high for a ${name} shot. Tilt the phone up a little.` };
  if (m.eyeY > eHi) return { ok: false, key: 'eyeslow', short: 'Tilt down', say: `Your eyes are too low for a ${name} shot. Tilt the phone down a little.` };
  if (Math.abs(m.offset) > TARGET.centerTolerance) {
    const dir = m.offset > 0 ? 'right' : 'left';
    return { ok: false, key: 'move' + dir, short: 'Move ' + dir, say: `Shift a little to your ${dir}.` };
  }
  return { ok: true, key: 'ok', short: 'Correct', say: 'The shot is correct.' };
}

// After the shot is locked, compare against the locked reference instead of the preset.
// ref: { eyeY, headHeight, offset } measured at the moment of locking.
export function driftVerdict(m, ref) {
  if (!m) return { ok: false, key: 'noface', short: 'Lost your face', say: 'I lost your face. Step back into the frame.' };
  if (m.eyeY < ref.eyeY - DRIFT.eyeY) return { ok: false, key: 'eyeshigh', short: 'Tilt up', say: 'Your eyes drifted up. Tilt the phone up a little.' };
  if (m.eyeY > ref.eyeY + DRIFT.eyeY) return { ok: false, key: 'eyeslow', short: 'Tilt down', say: 'Your eyes drifted down. Tilt the phone down a little.' };
  const ratio = m.headHeight / ref.headHeight;
  if (ratio > 1 + DRIFT.size) return { ok: false, key: 'toobig', short: 'Step back', say: 'You moved closer. Step back a little.' };
  if (ratio < 1 - DRIFT.size) return { ok: false, key: 'toosmall', short: 'Come closer', say: 'You moved back. Come a little closer.' };
  const d = m.offset - ref.offset;
  if (Math.abs(d) > DRIFT.offset) {
    const dir = d > 0 ? 'right' : 'left';
    return { ok: false, key: 'move' + dir, short: 'Move ' + dir, say: `Shift a little to your ${dir}.` };
  }
  return { ok: true, key: 'ok', short: 'Locked', say: 'Back in position.' };
}

// b: map of blendshape name -> score 0..1 (MediaPipe FaceLandmarker). Scores are rough, 0..1.
export function emotionScores(b) {
  const g = (k) => b[k] || 0;
  const avg = (a, c) => (g(a) + g(c)) / 2;
  const smile = avg('mouthSmileLeft', 'mouthSmileRight');
  const cheek = avg('cheekSquintLeft', 'cheekSquintRight');
  const browDown = avg('browDownLeft', 'browDownRight');
  const browUp = g('browInnerUp');
  const eyeWide = avg('eyeWideLeft', 'eyeWideRight');
  const squint = avg('eyeSquintLeft', 'eyeSquintRight');
  const frown = avg('mouthFrownLeft', 'mouthFrownRight');
  const press = avg('mouthPressLeft', 'mouthPressRight');
  const jaw = g('jawOpen');
  const noSmile = 1 - ramp(smile, 0.1, 0.4);
  const activity = Math.max(smile, browDown, browUp, jaw, frown, eyeWide);
  return {
    calm: 1 - ramp(activity, 0.05, 0.3),
    joy: 0.7 * ramp(smile, 0.15, 0.6) + 0.3 * ramp(cheek, 0.05, 0.4),
    surprise: 0.4 * ramp(browUp, 0.2, 0.6) + 0.35 * ramp(eyeWide, 0.1, 0.5) + 0.25 * ramp(jaw, 0.1, 0.4),
    compassion: (0.5 * band(smile, 0.08, 0.15, 0.4, 0.6) + 0.5 * band(browUp, 0.08, 0.15, 0.45, 0.7)) * (1 - ramp(jaw, 0.1, 0.3)),
    sadness: (0.5 * ramp(browUp, 0.15, 0.5) + 0.5 * ramp(frown, 0.1, 0.45)) * noSmile,
    anger: (0.55 * ramp(browDown, 0.2, 0.65) + 0.25 * ramp(press, 0.1, 0.5) + 0.2 * ramp(squint, 0.1, 0.5)) * noSmile,
  };
}

export const EMOTIONS = [
  { key: 'calm', label: 'calm', threshold: 0.8, hold: 1000,
    say: "First, calm. Soften your face, drop your shoulders, breathe out slowly, and say: Let's slow down for a second.",
    nudge: 'Relax your forehead and your jaw. Nothing moving, just steady eyes.' },
  { key: 'joy', label: 'joy', threshold: 0.65, hold: 700,
    say: 'Now joy. Think of the moment something finally clicked. Let the smile reach your eyes and say: I finally get it.',
    nudge: 'Smile bigger and lift your cheeks, like you just heard great news.' },
  { key: 'surprise', label: 'surprise', threshold: 0.6, hold: 600,
    say: 'Now surprise. Raise your eyebrows, open your eyes wide, and say: Wait, that is the opposite of what I expected.',
    nudge: 'Eyebrows higher, eyes wider, and let your mouth drop open a little.' },
  { key: 'compassion', label: 'compassion', threshold: 0.6, hold: 800,
    say: 'Now compassion. Tilt your head slightly, soften your eyes, keep a small warm smile, and say: You are not behind. You are learning.',
    nudge: 'Lift only the inner part of your eyebrows and keep the smile small and gentle.' },
  { key: 'sadness', label: 'sadness', threshold: 0.55, hold: 700,
    say: 'Now sadness. Let your brows pull up in the middle, let the corners of your mouth drop, and say: I used to think resting meant I was failing.',
    nudge: 'Pull the middle of your brows up and let your mouth corners fall.' },
  { key: 'anger', label: 'intensity', threshold: 0.55, hold: 700,
    say: 'Now intensity. Pull your brows down, hold your jaw firm, look straight into the lens, and say: This is the part nobody tells you.',
    nudge: 'Brows lower and closer together, lips pressed, stare into the lens.' },
];
