import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadVideo, renderVideo } from "./creatomate.js";
import { generateScript } from "./script.js";
import { getNextTopic } from "./topics.js";
import type { HistoryEntry } from "./types.js";
import { uploadShort } from "./youtube.js";

const HISTORY_PATH = new URL("../data/history.json", import.meta.url);

async function appendHistory(entry: HistoryEntry): Promise<void> {
  const raw = await readFile(HISTORY_PATH, "utf-8");
  const history = JSON.parse(raw) as HistoryEntry[];
  history.push(entry);
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
}

/**
 * Exécute un cycle complet : sujet -> script -> rendu vidéo -> upload YouTube -> historique.
 * Conçu pour être lancé une fois par exécution planifiée (voir .github/workflows).
 */
export async function runPipeline(): Promise<void> {
  console.log("1/5 — Sélection du sujet...");
  const topic = await getNextTopic();
  console.log(`   -> "${topic.title}"`);

  console.log("2/5 — Génération du script...");
  const script = await generateScript(topic);
  console.log(`   -> Titre : "${script.title}"`);

  console.log("3/5 — Rendu vidéo (Creatomate)...");
  const { url: renderedUrl } = await renderVideo({
    "Voiceover-1.text": script.voiceoverScript,
    "Caption-1.text": script.voiceoverScript,
    "Title-1.text": script.title,
  });

  const workDir = join(tmpdir(), `short-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  const videoPath = join(workDir, "short.mp4");

  try {
    console.log("4/5 — Téléchargement de la vidéo rendue...");
    await downloadVideo(renderedUrl, videoPath);

    console.log("5/5 — Publication sur YouTube...");
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
    await rm(workDir, { recursive: true, force: true });
  }
}
