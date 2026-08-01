import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "./config.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
const PEXELS_API = "https://api.pexels.com/videos";
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
}

interface PexelsSearchResponse {
  videos: { video_files: PexelsVideoFile[] }[];
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

async function synthesizeVoiceElevenLabs(text: string, destPath: string): Promise<void> {
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

/** Repli gratuit (Microsoft Edge TTS, via le paquet Python edge-tts) si ElevenLabs échoue. */
async function synthesizeVoiceEdgeTts(text: string, destPath: string, workDir: string): Promise<void> {
  const textFile = join(workDir, "voiceover-text.txt");
  await writeFile(textFile, text, "utf-8");
  await run("python3", [
    "-m",
    "edge_tts",
    "--file",
    textFile,
    "--voice",
    config.edgeTtsVoice,
    "--write-media",
    destPath,
  ]);
}

/** Essaie ElevenLabs en premier, puis Edge TTS (gratuit) si ça échoue (quota dépassé, panne, etc.). */
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

/**
 * Cherche une vidéo de stock verticale/proche sur Pexels et la télécharge. Retourne false
 * (au lieu de lever une erreur) si rien n'est trouvé ou si l'appel échoue, pour ne jamais
 * faire échouer tout le pipeline à cause d'un simple manque de résultat visuel.
 */
async function fetchBackgroundVideo(query: string, destPath: string): Promise<boolean> {
  try {
    const searchRes = await fetch(
      `${PEXELS_API}/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
      { headers: { Authorization: config.pexelsApiKey } },
    );
    if (!searchRes.ok) {
      console.warn(`Pexels API -> ${searchRes.status}, on utilisera un fond uni.`);
      return false;
    }

    const data = (await searchRes.json()) as PexelsSearchResponse;
    const files = data.videos.flatMap((v) => v.video_files);
    const best =
      files.find((f) => f.quality === "hd" && f.width < f.height) ??
      files.find((f) => f.width < f.height) ??
      files[0];

    if (!best) {
      console.warn(`Aucune vidéo Pexels trouvée pour "${query}", on utilisera un fond uni.`);
      return false;
    }

    const videoRes = await fetch(best.link);
    if (!videoRes.ok) {
      console.warn(`Téléchargement Pexels échoué -> ${videoRes.status}, on utilisera un fond uni.`);
      return false;
    }
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(destPath, buffer);
    return true;
  } catch (err) {
    console.warn(`Pexels indisponible (${err instanceof Error ? err.message : err}), fond uni utilisé.`);
    return false;
  }
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
 * Génère la voix off (ElevenLabs), récupère un fond vidéo de stock (Pexels) lié au sujet,
 * puis assemble la vidéo verticale (fond + titre + sous-titres) avec ffmpeg. Si aucune
 * vidéo de stock n'est trouvée, un fond uni sert de repli plutôt que de faire échouer le run.
 */
export async function renderVideo(params: {
  title: string;
  voiceoverScript: string;
  visualKeyword: string;
}): Promise<{ videoPath: string }> {
  const workDir = join(tmpdir(), `render-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const audioPath = join(workDir, "voiceover.mp3");
  await synthesizeVoice(params.voiceoverScript, audioPath, workDir);

  const duration = await getAudioDuration(audioPath);
  const chunks = splitIntoChunks(params.voiceoverScript, duration);

  const titleFile = join(workDir, "title.txt");
  await writeFile(titleFile, wrapText(params.title, 24), "utf-8");

  const drawtextFilters: string[] = [
    `drawbox=x=0:y=0:w=1080:h=1920:color=black@0.35:t=fill`,
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

  const backgroundPath = join(workDir, "background.mp4");
  const hasBackground = await fetchBackgroundVideo(params.visualKeyword, backgroundPath);

  const outputPath = join(workDir, "output.mp4");
  const drawtextChain = drawtextFilters.join(",");

  if (hasBackground) {
    await run("ffmpeg", [
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      backgroundPath,
      "-i",
      audioPath,
      "-filter_complex",
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,${drawtextChain}[out]`,
      "-map",
      "[out]",
      "-map",
      "1:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      outputPath,
    ]);
  } else {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=#222222:s=1080x1920:d=${duration.toFixed(2)}`,
      "-i",
      audioPath,
      "-vf",
      drawtextChain,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      outputPath,
    ]);
  }

  return { videoPath: outputPath };
}
