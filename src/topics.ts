import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { extractJson, generateText } from "./claude.js";
import { config } from "./config.js";
import type { Topic } from "./types.js";

const TOPICS_PATH = new URL("../data/topics.json", import.meta.url);
const IDEATION_BATCH_SIZE = 10;

const ideasSchema = z.array(z.string().min(1)).min(1);

async function loadTopics(): Promise<Topic[]> {
  const raw = await readFile(TOPICS_PATH, "utf-8");
  return JSON.parse(raw) as Topic[];
}

async function saveTopics(topics: Topic[]): Promise<void> {
  await writeFile(TOPICS_PATH, `${JSON.stringify(topics, null, 2)}\n`, "utf-8");
}

/**
 * Demande à Claude un lot de nouvelles idées de sujets pour la niche configurée.
 * Appelé uniquement quand la file data/topics.json est vide.
 */
async function ideateTopics(existingTitles: string[]): Promise<Topic[]> {
  const text = await generateText({
    maxTokens: 1024,
    prompt:
      `Tu proposes des idées de vidéos YouTube Shorts pour une chaîne sur : "${config.channelNiche}". ` +
      `Ton de la chaîne : ${config.channelTone}. Langue : ${config.channelLanguage}. ` +
      `Donne ${IDEATION_BATCH_SIZE} idées de sujets courts et accrocheurs, chacun exploitable en 45-60 ` +
      `secondes de vidéo, sans répéter ces sujets déjà utilisés : ` +
      `${existingTitles.length ? existingTitles.join(", ") : "(aucun)"}. ` +
      `Réponds UNIQUEMENT avec un tableau JSON de chaînes de caractères, ex: ["Sujet 1", "Sujet 2", ...]. ` +
      `Aucun texte avant ou après le JSON.`,
  });

  const ideas = ideasSchema.parse(extractJson<string[]>(text));
  const now = new Date().toISOString();
  return ideas.map((title) => ({ id: randomUUID(), title, createdAt: now }));
}

/**
 * Retourne le prochain sujet à traiter, en le retirant de la file. Régénère un lot
 * d'idées via Claude si la file est vide.
 */
export async function getNextTopic(): Promise<Topic> {
  let topics = await loadTopics();

  if (topics.length === 0) {
    console.log("File de sujets vide — génération d'un nouveau lot via Claude...");
    topics = await ideateTopics([]);
  }

  const [next, ...rest] = topics;
  if (!next) {
    throw new Error("Impossible d'obtenir un sujet : la génération d'idées a renvoyé une liste vide.");
  }

  await saveTopics(rest);
  return next;
}
