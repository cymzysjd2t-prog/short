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
 * Exécute un cycle complet pour la chaîne stickman : scénario -> chorégraphie du duel (Claude)
 * -> voix + animation générée par le moteur maison -> upload YouTube -> historique.
 */
export async function runStickPipeline(): Promise<void> {
  console.log("1/4 — Sélection du scénario de duel...");
  const topic = await getNextStickTopic();
  console.log(`   -> "${topic.title}"`);

  console.log("2/4 — Génération de la chorégraphie du combat...");
  const script = await generateStickScript(topic);
  console.log(`   -> Titre : "${script.title}" (${script.beats.length} beats)`);

  console.log("3/4 — Génération de la voix et animation du duel...");
  const { videoPath } = await renderStickVideo({
    beats: script.beats,
    fighterAName: script.fighterAName,
    fighterBName: script.fighterBName,
  });

  try {
    console.log("4/4 — Publication sur YouTube (chaîne stickman)...");
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
