import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copie .env.example vers .env et remplis-la ` +
        `(ou renseigne le secret correspondant dans les paramètres GitHub Actions).`,
    );
  }
  return value;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),

  creatomateApiKey: required("CREATOMATE_API_KEY"),
  creatomateTemplateId: required("CREATOMATE_TEMPLATE_ID"),

  youtubeClientId: required("YOUTUBE_CLIENT_ID"),
  youtubeClientSecret: required("YOUTUBE_CLIENT_SECRET"),
  youtubeRefreshToken: required("YOUTUBE_REFRESH_TOKEN"),
  youtubePrivacyStatus: (process.env.YOUTUBE_PRIVACY_STATUS ?? "public") as
    | "public"
    | "unlisted"
    | "private",
  youtubeCategoryId: process.env.YOUTUBE_CATEGORY_ID ?? "22",

  channelNiche: process.env.CHANNEL_NICHE ?? "Faits divers et anecdotes surprenantes",
  channelTone: process.env.CHANNEL_TONE ?? "direct, punchy, sans blabla",
  channelLanguage: process.env.CHANNEL_LANGUAGE ?? "français",
};
