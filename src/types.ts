export interface Topic {
  id: string;
  title: string;
  createdAt: string;
}

export interface ScriptResult {
  title: string;
  description: string;
  tags: string[];
  voiceoverScript: string;
}

export interface HistoryEntry {
  publishedAt: string;
  topic: string;
  title: string;
  youtubeVideoId: string;
  youtubeUrl: string;
}
