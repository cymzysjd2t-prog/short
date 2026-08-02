import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stickConfig } from "./stick-config.js";
import type { StickScriptResult } from "./stick-script.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
const PEXELS_API = "https://api.pexels.com/videos";
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

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

/** Cherche une vidéo de stock verticale/proche sur Pexels. Retourne false si rien n'est trouvé. */
async function tryFetchPexelsVideo(query: string, destPath: string): Promise<boolean> {
  try {
    const searchRes = await fetch(
      `${PEXELS_API}/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
      { headers: { Authorization: stickConfig.pexelsApiKey } },
    );
    if (!searchRes.ok) {
      console.warn(`Pexels API -> ${searchRes.status} pour "${query}".`);
      return false;
    }

    const data = (await searchRes.json()) as PexelsSearchResponse;
    const files = data.videos.flatMap((v) => v.video_files);
    const best =
      files.find((f) => f.quality === "hd" && f.width < f.height) ??
      files.find((f) => f.width < f.height) ??
      files[0];

    if (!best) {
      console.warn(`Aucune vidéo Pexels trouvée pour "${query}".`);
      return false;
    }

    const videoRes = await fetch(best.link);
    if (!videoRes.ok) {
      console.warn(`Téléchargement Pexels échoué -> ${videoRes.status} pour "${query}".`);
      return false;
    }
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(destPath, buffer);
    return true;
  } catch (err) {
    console.warn(`Pexels indisponible pour "${query}" (${err instanceof Error ? err.message : err}).`);
    return false;
  }
}

/**
 * Garantit qu'un fichier vidéo existe à destPath pour cet élément : vidéo Pexels liée au
 * mot-clé si possible, sinon un fond de couleur unie de la même durée en repli.
 */
async function ensureBackgroundSegment(query: string, destPath: string, duration: number): Promise<void> {
  const found = await tryFetchPexelsVideo(query, destPath);
  if (!found) {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=#20232a:s=1080x1920:d=${duration.toFixed(2)}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      destPath,
    ]);
  }
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

interface RenderItem {
  /** Ce qui est dit à voix haute pour cet élément (inclut l'annonce "Top N" pour les faits). */
  spokenText: string;
  /** Grand texte affiché à l'écran (ex: "TOP 5", "N°5"). Absent pour l'intro. */
  label?: string;
  /** Texte du fait affiché en bas de l'écran. Absent pour l'intro. */
  bodyText?: string;
  visualKeyword: string;
}

/**
 * Génère la voix off (une seule piste pour l'accroche + tous les éléments, avec l'annonce
 * "Top N" dite à voix haute à chaque nouvel élément), récupère une vraie vidéo de stock
 * (Pexels) pour chaque segment, les enchaîne, puis superpose le rang en grand et le texte de
 * chaque fait au bon moment.
 */
export async function renderStickVideo(script: StickScriptResult): Promise<{ videoPath: string }> {
  const workDir = join(tmpdir(), `stick-render-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const items: RenderItem[] = [
    { spokenText: script.intro, label: `TOP ${script.facts.length}`, visualKeyword: script.introVisualKeyword },
    ...script.facts.map((fact) => ({
      spokenText: `Top ${fact.rank}. ${fact.text}`,
      label: fact.label,
      bodyText: fact.text,
      visualKeyword: fact.visualKeyword,
    })),
  ];

  const fullNarration = items.map((item) => item.spokenText).join(" ");
  const audioPath = join(workDir, "voiceover.mp3");
  await synthesizeVoice(fullNarration, audioPath, workDir);

  const duration = await getAudioDuration(audioPath);
  const totalChars = items.reduce((sum, item) => sum + item.spokenText.length, 0) || 1;

  const segmentPaths: string[] = [];
  const segmentDurations: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const segmentDuration = duration * (item.spokenText.length / totalChars);
    const segmentPath = join(workDir, `bg-${i}.mp4`);
    await ensureBackgroundSegment(item.visualKeyword, segmentPath, segmentDuration);
    segmentPaths.push(segmentPath);
    segmentDurations.push(segmentDuration);
  }

  const inputArgs: string[] = [];
  const scaleLabels: string[] = [];
  const drawtextParts: string[] = [];

  segmentPaths.forEach((path, i) => {
    const segmentDuration = segmentDurations[i] ?? 0;
    inputArgs.push("-stream_loop", "-1", "-t", segmentDuration.toFixed(2), "-i", path);
    scaleLabels.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}]`,
    );
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const segmentDuration = segmentDurations[i] ?? 0;
    const start = segmentDurations.slice(0, i).reduce((a, b) => a + b, 0);
    const end = start + segmentDuration;
    const enable = `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;

    if (item.bodyText) {
      drawtextParts.push(`drawbox=x=0:y=ih*0.18:w=1080:h=ih*0.16:color=black@0.4:t=fill:${enable}`);
    }

    if (item.label) {
      const labelFile = join(workDir, `label-${i}.txt`);
      await writeFile(labelFile, item.label, "utf-8");
      const labelY = item.bodyText ? "h*0.20" : "(h-text_h)/2";
      drawtextParts.push(
        `drawtext=fontfile=${FONT_PATH}:textfile=${labelFile}:fontcolor=white:fontsize=110:` +
          `x=(w-text_w)/2:y=${labelY}:${enable}`,
      );
    }

    if (item.bodyText) {
      const textFile = join(workDir, `text-${i}.txt`);
      await writeFile(textFile, wrapText(item.bodyText, 26), "utf-8");

      drawtextParts.push(
        `drawtext=fontfile=${FONT_PATH}:textfile=${textFile}:fontcolor=white:fontsize=52:` +
          `x=(w-text_w)/2:y=h*0.72:box=1:boxcolor=black@0.45:boxborderw=18:${enable}`,
      );
    }
  }

  const concatInputs = segmentPaths.map((_, i) => `[v${i}]`).join("");
  const concatFilter = `${concatInputs}concat=n=${segmentPaths.length}:v=1:a=0[bg]`;
  const filterComplex = [...scaleLabels, concatFilter, `[bg]${drawtextParts.join(",")}[out]`].join(";");

  const audioInputIndex = segmentPaths.length;
  const outputPath = join(workDir, "output.mp4");

  await run("ffmpeg", [
    "-y",
    ...inputArgs,
    "-i",
    audioPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[out]",
    "-map",
    `${audioInputIndex}:a`,
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
