import { createCanvas, type CanvasRenderingContext2D } from "canvas";

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
export const GROUND_Y = 1500;
export const FPS = 30;

const TORSO = 220;
const UPPER_ARM = 130;
const LOWER_ARM = 120;
const UPPER_LEG = 170;
const LOWER_LEG = 170;
const HEAD_R = 62;
const STAND_HIP_HEIGHT = 300;
const LIMB_WIDTH = 14;

export interface Pose {
  hipXOffset: number;
  hipYOffset: number;
  lean: number;
  headBob: number;
  shoulderA: number;
  elbowA: number;
  shoulderB: number;
  elbowB: number;
  hipA: number;
  kneeA: number;
  hipB: number;
  kneeB: number;
}

export const IDLE_POSE: Pose = {
  hipXOffset: 0,
  hipYOffset: 0,
  lean: 0.05,
  headBob: 0,
  shoulderA: 0.75,
  elbowA: 1.7,
  shoulderB: 0.75,
  elbowB: 1.7,
  hipA: -0.08,
  kneeA: 0.18,
  hipB: 0.08,
  kneeB: 0.18,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hipXOffset: lerp(a.hipXOffset, b.hipXOffset, t),
    hipYOffset: lerp(a.hipYOffset, b.hipYOffset, t),
    lean: lerp(a.lean, b.lean, t),
    headBob: lerp(a.headBob, b.headBob, t),
    shoulderA: lerp(a.shoulderA, b.shoulderA, t),
    elbowA: lerp(a.elbowA, b.elbowA, t),
    shoulderB: lerp(a.shoulderB, b.shoulderB, t),
    elbowB: lerp(a.elbowB, b.elbowB, t),
    hipA: lerp(a.hipA, b.hipA, t),
    kneeA: lerp(a.kneeA, b.kneeA, t),
    hipB: lerp(a.hipB, b.hipB, t),
    kneeB: lerp(a.kneeB, b.kneeB, t),
  };
}

interface Keyframe {
  t: number;
  pose: Pose;
}

/** Interpole une pose à l'instant t (0..1) à partir d'une liste de keyframes triées. */
function poseFromKeyframes(keyframes: Keyframe[], t: number): Pose {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (!a || !b) continue;
    if (clamped >= a.t && clamped <= b.t) {
      const localT = b.t === a.t ? 0 : (clamped - a.t) / (b.t - a.t);
      return lerpPose(a.pose, b.pose, localT);
    }
  }
  return keyframes[keyframes.length - 1]?.pose ?? IDLE_POSE;
}

function p(overrides: Partial<Pose>): Pose {
  return { ...IDLE_POSE, ...overrides };
}

/** Bibliothèque de mouvements : chaque mouvement est une fonction t (0..1) -> Pose. */
export const MOVES: Record<string, (t: number) => Pose> = {
  idle: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ headBob: 0 }) },
        { t: 0.5, pose: p({ headBob: 6, shoulderA: 0.65, shoulderB: 0.85 }) },
        { t: 1, pose: p({ headBob: 0 }) },
      ],
      t,
    ),

  walk_in: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ hipXOffset: -420, hipA: 0.5, kneeA: 0.9, hipB: -0.5, kneeB: 0.2 }) },
        {
          t: 0.25,
          pose: p({ hipXOffset: -300, hipA: -0.4, kneeA: 0.2, hipB: 0.5, kneeB: 0.9, hipYOffset: 10 }),
        },
        { t: 0.5, pose: p({ hipXOffset: -180, hipA: 0.5, kneeA: 0.9, hipB: -0.5, kneeB: 0.2 }) },
        {
          t: 0.75,
          pose: p({ hipXOffset: -60, hipA: -0.4, kneeA: 0.2, hipB: 0.5, kneeB: 0.9, hipYOffset: 10 }),
        },
        { t: 1, pose: p({ hipXOffset: 0 }) },
      ],
      t,
    ),

  punch: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ lean: 0.05 }) },
        { t: 0.3, pose: p({ shoulderA: 0.4, elbowA: 2.5, lean: -0.05 }) },
        { t: 0.55, pose: p({ shoulderA: 1.5, elbowA: 1.45, lean: 0.35, hipXOffset: 40 }) },
        { t: 0.8, pose: p({ shoulderA: 1.4, elbowA: 1.6, lean: 0.25, hipXOffset: 25 }) },
        { t: 1, pose: p({ lean: 0.05 }) },
      ],
      t,
    ),

  kick: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ lean: 0.05 }) },
        { t: 0.3, pose: p({ hipA: 1.3, kneeA: 2.6, lean: -0.2, hipYOffset: 15 }) },
        { t: 0.55, pose: p({ hipA: 1.35, kneeA: 1.4, lean: -0.35, hipYOffset: 10, hipXOffset: 45 }) },
        { t: 0.8, pose: p({ hipA: 1.1, kneeA: 1.8, lean: -0.15, hipXOffset: 15 }) },
        { t: 1, pose: p({ lean: 0.05 }) },
      ],
      t,
    ),

  block: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ shoulderA: 1.4, elbowA: 2.7, shoulderB: 1.4, elbowB: 2.7, lean: -0.05 }) },
        { t: 0.5, pose: p({ shoulderA: 1.5, elbowA: 2.8, shoulderB: 1.5, elbowB: 2.8, lean: -0.1 }) },
        { t: 1, pose: p({ shoulderA: 1.4, elbowA: 2.7, shoulderB: 1.4, elbowB: 2.7, lean: -0.05 }) },
      ],
      t,
    ),

  dodge: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ hipXOffset: 0, hipYOffset: 0, lean: 0.05 }) },
        { t: 0.4, pose: p({ hipXOffset: -90, hipYOffset: -60, lean: 0.4, hipA: 0.6, hipB: 0.9 }) },
        { t: 0.6, pose: p({ hipXOffset: -90, hipYOffset: -60, lean: 0.4, hipA: 0.6, hipB: 0.9 }) },
        { t: 1, pose: p({ hipXOffset: 0, hipYOffset: 0, lean: 0.05 }) },
      ],
      t,
    ),

  hit_stagger: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ lean: 0.05, hipXOffset: 0 }) },
        {
          t: 0.3,
          pose: p({
            lean: -0.5,
            hipXOffset: -70,
            shoulderA: -0.3,
            shoulderB: -0.6,
            elbowA: 0.3,
            elbowB: 0.1,
          }),
        },
        { t: 0.7, pose: p({ lean: -0.3, hipXOffset: -50 }) },
        { t: 1, pose: p({ lean: 0.05, hipXOffset: 0 }) },
      ],
      t,
    ),

  fall: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ lean: -0.3, hipXOffset: -40, hipYOffset: 0 }) },
        {
          t: 1,
          pose: p({
            lean: -1.4,
            hipXOffset: -160,
            hipYOffset: -220,
            hipA: 1.4,
            kneeA: 1.5,
            hipB: 1.3,
            kneeB: 1.4,
            shoulderA: 1.1,
            shoulderB: 1.3,
          }),
        },
      ],
      t,
    ),

  victory: (t) =>
    poseFromKeyframes(
      [
        { t: 0, pose: p({ headBob: 0 }) },
        {
          t: 0.5,
          pose: p({ shoulderA: 2.7, elbowA: 2.9, shoulderB: -2.4, elbowB: -2.7, headBob: -20, hipYOffset: 25 }),
        },
        {
          t: 1,
          pose: p({ shoulderA: 2.7, elbowA: 2.9, shoulderB: -2.4, elbowB: -2.7, headBob: 0, hipYOffset: 0 }),
        },
      ],
      t,
    ),
};

export type MoveName = keyof typeof MOVES;
export const MOVE_NAMES = Object.keys(MOVES) as MoveName[];

function endpoint(x: number, y: number, angle: number, length: number, facing: 1 | -1): [number, number] {
  return [x + length * Math.sin(angle) * facing, y + length * Math.cos(angle)];
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle1: number,
  len1: number,
  angle2: number,
  len2: number,
  facing: 1 | -1,
  color: string,
): void {
  const [jx, jy] = endpoint(x, y, angle1, len1, facing);
  const [ex, ey] = endpoint(jx, jy, angle2, len2, facing);
  ctx.strokeStyle = color;
  ctx.lineWidth = LIMB_WIDTH;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(jx, jy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

export interface CharacterDraw {
  baseX: number;
  facing: 1 | -1;
  pose: Pose;
  color: string;
}

/** Dessine un bonhomme allumette à partir d'une pose et d'une position de base. */
export function drawStickman(ctx: CanvasRenderingContext2D, character: CharacterDraw): void {
  const { baseX, facing, pose, color } = character;
  const hipX = baseX + pose.hipXOffset * facing;
  const hipY = GROUND_Y - STAND_HIP_HEIGHT - pose.hipYOffset;

  const neckX = hipX + TORSO * Math.sin(pose.lean) * facing;
  const neckY = hipY - TORSO * Math.cos(pose.lean);
  const headX = neckX;
  const headY = neckY - HEAD_R - pose.headBob;

  ctx.strokeStyle = color;
  ctx.lineWidth = LIMB_WIDTH;
  ctx.lineCap = "round";

  drawLimb(ctx, hipX, hipY, pose.hipB, UPPER_LEG, pose.kneeB, LOWER_LEG, facing, color);
  drawLimb(ctx, hipX, hipY, pose.hipA, UPPER_LEG, pose.kneeA, LOWER_LEG, facing, color);

  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  drawLimb(ctx, neckX, neckY, pose.shoulderB, UPPER_ARM, pose.elbowB, LOWER_ARM, facing, color);
  drawLimb(ctx, neckX, neckY, pose.shoulderA, UPPER_ARM, pose.elbowA, LOWER_ARM, facing, color);

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
}

export function poseAt(move: string, t: number): Pose {
  return (MOVES[move] ?? MOVES.idle)!(t);
}

export function renderBackground(ctx: CanvasRenderingContext2D, bgColor: string): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 4);
  ctx.lineTo(CANVAS_W, GROUND_Y + 4);
  ctx.stroke();
}

export function wrapCaption(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function drawCaption(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.font = "bold 58px sans-serif";
  ctx.textAlign = "center";
  const lines = wrapCaption(ctx, text, CANVAS_W - 120);
  const lineHeight = 68;
  const boxHeight = lines.length * lineHeight + 50;
  const boxY = CANVAS_H - boxHeight - 90;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(40, boxY, CANVAS_W - 80, boxHeight);

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, boxY + 55 + i * lineHeight);
  });
}

export function createFrameCanvas() {
  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}
