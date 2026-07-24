import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "./config.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

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

async function synthesizeVoice(text: string, destPath: string): Promise<void> {
  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${config.elevenlabsVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenlabsApiKey,
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

/** Découpe le script en phrases, chacune affichée pendant une durée proportionnelle à sa longueur. */
function splitIntoChunks(script: string, totalDuration: number): CaptionChunk[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [{ text: script, start: 0, end: totalDuration }];
  }

  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
  let elapsed = 0;
  return sentences.map((text) => {
    const duration = totalDuration * (text.length / totalChars);
    const chunk: CaptionChunk = { text, start: elapsed, end: elapsed + duration };
    elapsed += duration;
    return chunk;
  });
}

function wrapText(text: string, maxLineLength: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxLineLength && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

/**
 * Génère la voix off (ElevenLabs) puis assemble la vidéo verticale (fond uni + titre +
 * sous-titres) avec ffmpeg. Aucun service de montage tiers payant requis.
 */
export async function renderVideo(params: { title: string; voiceoverScript: string }): Promise<{
  videoPath: string;
}> {
  const workDir = join(tmpdir(), `render-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const audioPath = join(workDir, "voiceover.mp3");
  await synthesizeVoice(params.voiceoverScript, audioPath);

  const duration = await getAudioDuration(audioPath);
  const chunks = splitIntoChunks(params.voiceoverScript, duration);

  const titleFile = join(workDir, "title.txt");
  await writeFile(titleFile, wrapText(params.title, 24), "utf-8");

  const drawtextFilters: string[] = [
    `drawtext=fontfile=${FONT_PATH}:textfile=${titleFile}:fontcolor=white:fontsize=64:` +
      `x=(w-text_w)/2:y=h*0.08:box=1:boxcolor=black@0.5:boxborderw=20`,
  ];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const captionFile = join(workDir, `caption-${i}.txt`);
    await writeFile(captionFile, wrapText(chunk.text, 28), "utf-8");
    drawtextFilters.push(
      `drawtext=fontfile=${FONT_PATH}:textfile=${captionFile}:fontcolor=white:fontsize=48:` +
        `x=(w-text_w)/2:y=h*0.75:box=1:boxcolor=black@0.6:boxborderw=16:` +
        `enable='between(t,${chunk.start.toFixed(2)},${chunk.end.toFixed(2)})'`,
    );
  }

  const outputPath = join(workDir, "output.mp4");
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=1080x1920:d=${duration.toFixed(2)}`,
    "-i",
    audioPath,
    "-vf",
    drawtextFilters.join(","),
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
