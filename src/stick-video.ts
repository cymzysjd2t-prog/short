import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stickConfig } from "./stick-config.js";
import { CANVAS_W, FPS, createFrameCanvas, renderBackground, drawStickman, drawCaption, poseAt } from "./stick-animate.js";
import type { FightBeat } from "./stick-script.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

const BG_COLOR = "#181c34";
const FIGHTER_A_COLOR = "#f5f5f5";
const FIGHTER_B_COLOR = "#ffb703";

const MIN_BEAT_SECONDS = 0.7;
const BASE_MOVE_SECONDS: Record<string, number> = {
  idle: 0.9,
  walk_in: 1.1,
  punch: 0.8,
  kick: 0.9,
  block: 0.8,
  dodge: 0.8,
  hit_stagger: 0.8,
  fall: 1.3,
  victory: 1.8,
};

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} a échoué (code ${code}) : ${stderr.slice(-2000)}`));
    });
    proc.on("error", reject);
  });
}

function runCapture(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} a échoué (code ${code}) : ${stderr.slice(-2000)}`));
    });
    proc.on("error", reject);
  });
}

async function synthesizeVoiceElevenLabs(text: string, destPath: string): Promise<void> {
  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${stickConfig.elevenlabsVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": stickConfig.elevenlabsApiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs API -> ${res.status}: ${body}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

async function synthesizeVoiceEdgeTts(text: string, destPath: string, workDir: string): Promise<void> {
  const textFile = join(workDir, "voiceover-text.txt");
  await writeFile(textFile, text, "utf-8");
  await run("python3", [
    "-m",
    "edge_tts",
    "--file",
    textFile,
    "--voice",
    stickConfig.edgeTtsVoice,
    "--write-media",
    destPath,
  ]);
}

async function synthesizeVoice(text: string, destPath: string, workDir: string): Promise<void> {
  try {
    await synthesizeVoiceElevenLabs(text, destPath);
  } catch (err) {
    console.warn(
      `ElevenLabs indisponible (${err instanceof Error ? err.message : err}) — repli sur Edge TTS (gratuit).`,
    );
    await synthesizeVoiceEdgeTts(text, destPath, workDir);
  }
}

async function getAudioDuration(filePath: string): Promise<number> {
  const out = await runCapture("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Durée audio invalide détectée : "${out.trim()}"`);
  }
  return seconds;
}

function computeBeatDurations(beats: FightBeat[], totalAudioSeconds: number): number[] {
  const weights = beats.map((beat) => {
    const base = BASE_MOVE_SECONDS[beat.moveA] ?? 0.9;
    return Math.max(base, beat.narration.length / 14);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const scale = totalAudioSeconds / weightSum;
  return weights.map((w) => Math.max(MIN_BEAT_SECONDS, w * scale));
}

/**
 * Génère la voix off (une piste unique pour tout le duel), puis dessine chaque frame du combat
 * image par image avec le moteur d'animation stickman, et encode le tout en vidéo avec ffmpeg.
 */
export async function renderStickVideo(params: {
  beats: FightBeat[];
  fighterAName: string;
  fighterBName: string;
}): Promise<{ videoPath: string }> {
  const { beats, fighterAName, fighterBName } = params;
  const workDir = join(tmpdir(), `stick-render-${randomUUID()}`);
  const framesDir = join(workDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const fullNarration = beats.map((beat) => beat.narration).join(" ");
  const audioPath = join(workDir, "voiceover.mp3");
  await synthesizeVoice(fullNarration, audioPath, workDir);

  const totalAudioSeconds = await getAudioDuration(audioPath);
  const beatDurations = computeBeatDurations(beats, totalAudioSeconds);

  let frameIndex = 0;
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const duration = beatDurations[i];
    if (!beat || !duration) continue;
    const frameCount = Math.max(1, Math.round(duration * FPS));

    for (let f = 0; f < frameCount; f++) {
      const t = frameCount === 1 ? 1 : f / (frameCount - 1);
      const { canvas, ctx } = createFrameCanvas();
      renderBackground(ctx, BG_COLOR);

      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(fighterAName, 50, 120);
      ctx.textAlign = "right";
      ctx.fillText(fighterBName, CANVAS_W - 50, 120);

      drawStickman(ctx, {
        baseX: CANVAS_W * 0.32,
        facing: 1,
        pose: poseAt(beat.moveA, t),
        color: FIGHTER_A_COLOR,
      });
      drawStickman(ctx, {
        baseX: CANVAS_W * 0.68,
        facing: -1,
        pose: poseAt(beat.moveB, t),
        color: FIGHTER_B_COLOR,
      });
      drawCaption(ctx, beat.caption);

      const framePath = join(framesDir, `frame-${String(frameIndex).padStart(6, "0")}.png`);
      await writeFile(framePath, canvas.toBuffer("image/png"));
      frameIndex++;
    }
  }

  const outputPath = join(workDir, "output.mp4");
  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    join(framesDir, "frame-%06d.png"),
    "-i",
    audioPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);

  return { videoPath: outputPath };
}
