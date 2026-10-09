import { z } from "zod";
export const Settings = z.object({
  AI_MODE: z.enum(["mock", "live"]).default("mock"),
  TEXT_MODEL: z.string().default("gpt-5.4-mini-2026-03-17"),
  IMAGE_MODEL: z.string().default("gpt-image-2.5-flare-2026-09-08"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(45000).default(45000),
  DAILY_AI_REQUEST_LIMIT: z.coerce.number().int().min(0).max(10000).default(30),
  DAILY_BUDGET_USD: z.coerce.number().nonnegative().max(100).default(0),
  SESSION_BUDGET_USD: z.coerce.number().nonnegative().max(100).default(0),
  TEXT_RESERVATION_USD: z.coerce.number().nonnegative().default(0),
  IMAGE_RESERVATION_USD: z.coerce.number().nonnegative().default(0),
  REGION: z.string().default("europe-west1"),
});
export type Settings = z.infer<typeof Settings>;
export const ART_BIBLE =
  "story-master-v1: original painterly storybook fantasy, believable stone and wood, misty forest greens, warm amber windows, first-person landscape, readable foreground and distance, gentle wonder, no gore, no text, no labels, no watermark";
