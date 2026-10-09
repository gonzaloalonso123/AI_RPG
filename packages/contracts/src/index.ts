import { z } from "zod";
export const Locale = z.enum(["es", "en"]);
export type Locale = z.infer<typeof Locale>;
export const ATTRIBUTES = [
  "Strength",
  "Agility",
  "Endurance",
  "Intelligence",
  "Perception",
  "Willpower",
  "Charisma",
  "Empathy",
  "Arcana",
  "Luck",
] as const;
export type Attributes = Record<(typeof ATTRIBUTES)[number], number>;
export const Action = z
  .object({
    kind: z.enum([
      "inspect",
      "talk",
      "travel",
      "attack",
      "negotiate",
      "rest",
      "take",
      "use",
      "pet",
      "wait",
      "assist",
      "equip",
      "buy",
      "sell",
      "skill",
      "drop",
      "escape",
    ]),
    target: z.string().max(80).default(""),
    itemId: z.string().max(80).optional(),
    skillId: z.string().max(80).optional(),
  })
  .strict();
export type Action = z.infer<typeof Action>;
export const Intention = z
  .object({
    text: z.string().trim().min(1).max(1200),
    mentions: z
      .array(
        z.object({ kind: z.enum(["item", "skill"]), id: z.string().max(80) }),
      )
      .max(8)
      .default([]),
  })
  .strict();
export type Intention = z.infer<typeof Intention>;
export const Command = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create"),
    name: z.string().trim().min(2).max(60),
    locale: Locale,
    capacity: z.number().int().min(1).max(4),
    difficulty: z.enum(["gentle", "standard", "hard"]),
    tone: z.enum(["wonder", "mystery", "humour"]),
  }),
  z.object({
    type: z.literal("join"),
    code: z.string().regex(/^[A-Z2-9]{8}$/),
  }),
  z.object({
    type: z.literal("character"),
    campaignId: z.string().max(80),
    name: z.string().trim().min(1).max(40),
    description: z.string().min(5).max(1000),
    petName: z.string().trim().min(1).max(40),
  }),
  z.object({
    type: z.literal("submit"),
    campaignId: z.string().max(80),
    version: z.number().int().nonnegative(),
    intention: Intention,
  }),
  z.object({
    type: z.literal("retract"),
    campaignId: z.string().max(80),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("control"),
    campaignId: z.string().max(80),
    operation: z.enum([
      "start",
      "pause",
      "resume",
      "archive",
      "rotate",
      "retry-art",
    ]),
  }),
  z.object({
    type: z.literal("language"),
    campaignId: z.string().max(80),
    locale: Locale,
  }),
  z.object({
    type: z.literal("ambition"),
    campaignId: z.string().max(80),
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("trade"),
    campaignId: z.string().max(80),
    operation: z.enum(["offer", "accept", "cancel"]),
    itemId: z.string().max(80),
    to: z.string().max(128),
  }),
  z.object({
    type: z.literal("delete"),
    campaignId: z.string().max(80),
    confirmation: z.literal("DELETE"),
  }),
]);
export type Command = z.infer<typeof Command>;
export interface Item {
  id: string;
  template: string;
  name: string;
  quantity: number;
  weight: number;
  value: number;
  tags: string[];
  equipped: boolean;
  rarity: "common" | "uncommon";
}
export interface Character {
  uid: string;
  name: string;
  description: string;
  portraitPath: string | null;
  portraitVersion: number;
  attributes: Attributes;
  hp: number;
  stamina: number;
  mana: number;
  gold: number;
  xp: number;
  level: number;
  items: Item[];
  skills: string[];
  practice: number;
  pet: { name: string; template: string; bond: number; exhausted: boolean };
  status: string[];
}
export type LocationId =
  | "square"
  | "tavern"
  | "market"
  | "inn"
  | "forest"
  | "ruins";
export interface Campaign {
  schemaVersion: 1;
  id: string;
  name: string;
  host: string;
  members: string[];
  capacity: number;
  locale: Locale;
  difficulty: "gentle" | "standard" | "hard";
  tone: "wonder" | "mystery" | "humour";
  phase:
    | "lobby"
    | "collecting"
    | "locked"
    | "resolving"
    | "paused"
    | "ended"
    | "archived";
  version: number;
  sceneVersion: number;
  location: LocationId;
  characters: Record<string, Character>;
  submitted: Record<string, Intention>;
  knownClues: string[];
  discoveries: Record<string, { es: string; en: string }>;
  clueSources: Record<string,string>;
  relationships: Record<string,number>;
  claimed: string[];
  enemyHp: number;
  skirmishes: Record<string,{hp:number;defeated:boolean}>;
  ending: null | "peace" | "battle";
  time: number;
  createdAt: number;
  updatedAt: number;
  narration: string;
  imagePath: string | null;
  imageStatus: "demo" | "pending" | "ready" | "failed";
  merchantStock: number;
  trade: null | { from: string; to: string; itemId: string; version: number };
}
export interface GameEvent {
  id: string;
  campaignId: string;
  sequence: number;
  kind: "outcome" | "discovery" | "claim" | "ambition" | "system";
  text: string;
  actor: string | null;
  roll: number | null;
  sourceIds: string[];
  location: LocationId;
  createdAt: number;
}
export interface Job {
  campaignId: string;
  kind: "round" | "presentation" | "summary" | "portrait" | "image";
  subjectUid?: string;
  version: number;
  sceneVersion: number;
  status: "pending" | "running" | "done" | "failed" | "uncertain";
  seed: number;
  fence: number;
  leaseUntil: number;
  attempts: number;
  createdAt: number;
  error?: string;
}
export const Narrative = z
  .object({ text: z.string().min(1).max(2500) })
  .strict();
export const Summary = z
  .object({
    text: z.string().max(1500),
    sourceIds: z.array(z.string()).max(20),
  })
  .strict();
