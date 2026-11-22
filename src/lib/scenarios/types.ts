import { z } from "zod";

export const DiplomacyStatusSchema = z.enum([
  "WAR",
  "ALLIANCE",
  "NON_AGGRESSION",
  "VASSAL",
  "EMBARGO",
  "NEUTRAL",
]);

export type DiplomacyStatus = z.infer<typeof DiplomacyStatusSchema>;

export const EventCategorySchema = z.enum([
  "WAR",
  "DIPLOMACY",
  "ECONOMY",
  "INTERNAL",
  "CRISIS",
]);

export type EventCategory = z.infer<typeof EventCategorySchema>;

export const ScenarioCountrySchema = z.object({
  code: z.string().min(2).max(16),
  name: z.string().min(1),
  flagEmoji: z.string().default("🏳️"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  leader: z.string().min(1),
  ideology: z.string().min(1),
  economy: z.number().int().min(0).max(100),
  military: z.number().int().min(0).max(100),
  stability: z.number().int().min(0).max(100),
  treasury: z.number().int().default(1000),
  capitalRegionId: z.string().optional(),
  isMajor: z.boolean().default(false),
  description: z.string().optional(),
  regions: z.array(z.string()).min(1),
});

export type ScenarioCountryDef = z.infer<typeof ScenarioCountrySchema>;

export const ScenarioDiplomacySchema = z.object({
  countryA: z.string().min(2),
  countryB: z.string().min(2),
  status: DiplomacyStatusSchema,
  treatyName: z.string().optional(),
});

export const ScenarioInitialEventSchema = z.object({
  headline: z.string().min(3),
  articleBody: z.string().min(5),
  category: EventCategorySchema,
  involvedCountries: z.array(z.string()).default([]),
});

export const ScenarioConfigSchema = z.object({
  id: z.string().min(2).max(40),
  slug: z.string().min(2).max(60),
  title: z.string().min(2),
  era: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turnIntervalMonths: z.number().int().min(1).max(60).default(3),
  globalTension: z.number().int().min(0).max(100).default(25),
  description: z.string().min(5),
  countries: z.array(ScenarioCountrySchema).min(2),
  diplomacies: z.array(ScenarioDiplomacySchema).default([]),
  initialEvents: z.array(ScenarioInitialEventSchema).default([]),
  fallbackOwnerMode: z.enum(["INDEPENDENT_MINOR", "UNCLAIMED"]).default("INDEPENDENT_MINOR"),
});

export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;
