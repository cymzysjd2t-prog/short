import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateScript } from "./script.js";
import { getNextTopic } from "./topics.js";
import type { HistoryEntry } from "./types.js";
import { renderVideo } from "./video.js";
import { uploadShort } from "./youtube.js";

const HISTORY_PATH = new URL("../data/history.json", import.meta.url);

async function appendHistory(entry: HistoryEntry): Promise<void> {
  const raw = await readFile(HISTORY_PATH, "utf-8");
  const history = JSON.parse(raw) as HistoryEntry[];
  history.push(entry);
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
}

/**
 * Exécute un cycle complet : sujet -> script -> voix + montage vidéo (local) -> upload
 * YouTube -> historique. Conçu pour être lancé une fois par exécution planifiée (voir
 * .github/workflows).
 */
export async function runPipeline(): Promise<void> {
  console.log("1/4 — Sélection du sujet...");
  const topic = await getNextTopic();
  console.log(`   -> "${topic.title}"`);

  console.log("2/4 — Génération du script...");
  const script = await generateScript(topic);
  console.log(`   -> Titre : "${script.title}"`);

  console.log("3/4 — Génération de la voix et montage vidéo (ElevenLabs + ffmpeg)...");
  const { videoPath } = await renderVideo({
    title: script.title,
    voiceoverScript: script.voiceoverScript,
  });

  try {
    console.log("4/4 — Publication sur YouTube...");
    const { videoId, url } = await uploadShort(videoPath, script);
    console.log(`   -> Publié : ${url}`);

    await appendHistory({
      publishedAt: new Date().toISOString(),
      topic: topic.title,
      title: script.title,
      youtubeVideoId: videoId,
      youtubeUrl: url,
    });
  } finally {
    await rm(dirname(videoPath), { recursive: true, force: true });
  }
}
