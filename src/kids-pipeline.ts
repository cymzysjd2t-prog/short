import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateKidsScript } from "./kids-script.js";
import { getNextKidsTopic } from "./kids-topics.js";
import { renderKidsVideo } from "./kids-video.js";
import { uploadKidsShort } from "./kids-youtube.js";

interface KidsHistoryEntry {
  publishedAt: string;
  topic: string;
  title: string;
  youtubeVideoId: string;
  youtubeUrl: string;
}

const HISTORY_PATH = new URL("../data/history-kids.json", import.meta.url);

async function appendHistory(entry: KidsHistoryEntry): Promise<void> {
  const raw = await readFile(HISTORY_PATH, "utf-8");
  const history = JSON.parse(raw) as KidsHistoryEntry[];
  history.push(entry);
  await writeFile(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
}

export async function runKidsPipeline(): Promise<void> {
  console.log("1/4 — Sélection du thème enfant...");
  const topic = await getNextKidsTopic();
  console.log(`   -> "${topic.title}"`);

  console.log("2/4 — Génération du script enfant...");
  const script = await generateKidsScript(topic);
  console.log(`   -> Titre : "${script.title}" (${script.items.length} items)`);

  console.log("3/4 — Génération de la voix et montage vidéo...");
  const { videoPath } = await renderKidsVideo({ items: script.items });

  try {
    console.log("4/4 — Publication sur YouTube (chaîne enfants)...");
    const { videoId, url } = await uploadKidsShort(videoPath, script);
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
