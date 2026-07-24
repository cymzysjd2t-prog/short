import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { config } from "./config.js";

const API_BASE = "https://api.creatomate.com/v2";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

interface CreatomateRender {
  id: string;
  status: "planned" | "waiting" | "transcribing" | "rendering" | "succeeded" | "failed";
  url?: string;
  error_message?: string;
}

async function creatomateFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.creatomateApiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Creatomate API ${path} -> ${res.status}: ${body}`);
  }
  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lance un rendu vidéo à partir du template configuré et attend qu'il soit terminé.
 * `modifications` doit correspondre aux noms d'éléments définis dans le template
 * Creatomate (voir creatomate/template-guide.md).
 */
export async function renderVideo(modifications: Record<string, string>): Promise<{ url: string }> {
  const created = await creatomateFetch("/renders", {
    method: "POST",
    body: JSON.stringify({
      template_id: config.creatomateTemplateId,
      modifications,
    }),
  });

const rawText = await created.text();
let parsed: CreatomateRender[] | CreatomateRender;
try {
  parsed = JSON.parse(rawText);
} catch {
  throw new Error(`Réponse Creatomate non-JSON à la création : ${rawText.slice(0, 500)}`);
}
const render = Array.isArray(parsed) ? parsed[0] : parsed;
if (!render || !render.id) {
  throw new Error(`Creatomate n'a renvoyé aucun rendu exploitable. Réponse brute : ${rawText.slice(0, 500)}`);
}
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const statusRes = await creatomateFetch(`/renders/${render.id}`);
    const current = (await statusRes.json()) as CreatomateRender;

    if (current.status === "succeeded" && current.url) {
      return { url: current.url };
    }
    if (current.status === "failed") {
      throw new Error(`Rendu Creatomate échoué : ${current.error_message ?? "raison inconnue"}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Rendu Creatomate ${render.id} non terminé après ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms.`);
}

export async function downloadVideo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Téléchargement de la vidéo rendue échoué -> ${res.status}`);
  }
  await streamPipeline(Readable.fromWeb(res.body as never), createWriteStream(destPath));
}
