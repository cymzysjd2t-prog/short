import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateStickScript } from "./stick-script.js";
import { getNextStickTopic } from "./stick-topics.js";
import { renderStickVideo } from "./stick-video.js";
import { uploadStickShort } from "./stick-youtube.js";

interface StickHistoryEntry {
  publishedAt: string;
  topic: string;
  title: string;
  youtubeVideoId: string;
  youtubeUrl: string;
}

const HISTORY_PATH = new URL("../data/history-stick.json", import.meta.url);

async function appendHistory(entry: StickHistoryEntry): Promise<void> {
  const raw = await readFile(HISTORY_PATH, "utf-8");
  const history = JSON.parse(raw) as StickHistoryEntry[];
  history.push(entry);
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
}

/**
 * Exécute un cycle complet pour la chaîne "Top" : thème -> script (classement de faits, Claude)
 * -> voix + montage vidéo (vraies vidéos de stock Pexels) -> upload YouTube -> historique.
 */
export async function runStickPipeline(): Promise<void> {
  console.log("1/4 — Sélection du thème...");
  const topic = await getNextStickTopic();
  console.log(`   -> "${topic.title}"`);

  console.log("2/4 — Génération du script (classement de faits)...");
  const script = await generateStickScript(topic);
  console.log(`   -> Titre : "${script.title}" (${script.facts.length} faits)`);

  console.log("3/4 — Génération de la voix et montage vidéo...");
  const { videoPath } = await renderStickVideo(script);

  try {
    console.log("4/4 — Publication sur YouTube (chaîne Top)...");
    const { videoId, url } = await uploadStickShort(videoPath, script);
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
