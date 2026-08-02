import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { stickConfig } from "./stick-config.js";
import type { StickScriptResult } from "./stick-script.js";

function getOAuthClient() {
  const client = new google.auth.OAuth2(stickConfig.youtubeClientId, stickConfig.youtubeClientSecret);
  client.setCredentials({ refresh_token: stickConfig.youtubeRefreshToken });
  return client;
}

export async function uploadStickShort(
  filePath: string,
  script: StickScriptResult,
): Promise<{ videoId: string; url: string }> {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const description = script.description.includes("#Shorts")
    ? script.description
    : `${script.description}\n\n#Shorts`;

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: script.title,
        description,
        tags: script.tags,
        categoryId: stickConfig.youtubeCategoryId,
      },
      status: {
        privacyStatus: stickConfig.youtubePrivacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(filePath),
    },
  });

  const videoId = res.data.id;
  if (!videoId) {
    throw new Error("L'upload YouTube (chaîne Top) a réussi mais n'a renvoyé aucun ID de vidéo.");
  }

  return { videoId, url: `https://youtube.com/shorts/${videoId}` };
}
