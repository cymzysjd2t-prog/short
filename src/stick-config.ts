import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Renseigne le secret correspondant dans les ` +
        `paramètres GitHub Actions.`,
    );
  }
  return value;
}

export const stickConfig = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  elevenlabsApiKey: required("ELEVENLABS_API_KEY"),
  elevenlabsVoiceId: process.env.STICK_ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9",
  edgeTtsVoice: process.env.STICK_EDGE_TTS_VOICE || "fr-FR-HenriNeural",
  pexelsApiKey: required("PEXELS_API_KEY"),

  youtubeClientId: required("STICK_YOUTUBE_CLIENT_ID"),
  youtubeClientSecret: required("STICK_YOUTUBE_CLIENT_SECRET"),
  youtubeRefreshToken: required("STICK_YOUTUBE_REFRESH_TOKEN"),
  youtubePrivacyStatus: (process.env.STICK_YOUTUBE_PRIVACY_STATUS || "public") as
    | "public"
    | "unlisted"
    | "private",
  youtubeCategoryId: process.env.STICK_YOUTUBE_CATEGORY_ID || "24",

  channelNiche:
    process.env.STICK_CHANNEL_NICHE ||
    "Tops et faits insolites incroyables (records, mystères, curiosités du monde) façon Bright Side / WatchMojo",
  channelTone:
    process.env.STICK_CHANNEL_TONE ||
    "punchy, direct, suspense crescendo, révélation finale qui surprend, donne envie de regarder jusqu'au bout",
  channelLanguage: process.env.STICK_CHANNEL_LANGUAGE || "français",
};
