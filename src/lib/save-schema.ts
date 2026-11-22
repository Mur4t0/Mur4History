import { z } from "zod";

const NullableString = z.string().nullable().optional();

export const SaveArchiveCountrySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  flagEmoji: z.string(),
  color: z.string(),
  leader: z.string(),
  ideology: z.string(),
  economy: z.number().int(),
  military: z.number().int(),
  stability: z.number().int(),
  treasury: z.number().int(),
  infamy: z.number().int().default(0),
  warExhaustion: z.number().int().default(0),
  capitalRegionId: NullableString,
  isMajor: z.boolean().default(false),
  description: NullableString,
});

export const SaveArchiveRegionSchema = z.object({
  regionId: z.string().min(1),
  regionName: z.string(),
  ownerCountryCode: z.string().min(1),
  strategicStatus: z.string().default("CORE"),
  baseValue: z.number().int().default(5),
  lastTransferredTurn: z.number().int().nullable().optional(),
  transferReason: NullableString,
});

export const SaveArchiveDiplomacySchema = z.object({
  countryA: z.string().min(1),
  countryB: z.string().min(1),
  status: z.string(),
  treatyName: NullableString,
  updatedTurn: z.number().int().default(1),
});

export const SaveArchiveOrderSchema = z.object({
  countryCode: z.string().min(1),
  orderType: z.string().default("COMMAND"),
  targetCountryCode: NullableString,
  content: z.string(),
  turnNumber: z.number().int(),
  status: z.string().default("PENDING"),
  createdAt: z.string().optional(),
});

export const SaveArchiveEventSchema = z.object({
  turnNumber: z.number().int(),
  gameDate: z.string(),
  headline: z.string(),
  articleBody: z.string(),
  category: z.string(),
  involvedCountries: z.string(),
  createdAt: z.string().optional(),
});

export const SaveArchiveDiplomaticMessageSchema = z.object({
  turnNumber: z.number().int(),
  gameDate: z.string(),
  fromCountryCode: z.string(),
  toCountryCode: z.string(),
  senderTitle: z.string(),
  message: z.string(),
  isFromPlayer: z.boolean().default(false),
  createdAt: z.string().optional(),
});

export const SaveArchiveLeaderChatSchema = z.object({
  countryCode: z.string(),
  playerCountryCode: z.string(),
  senderRole: z.string(),
  senderName: z.string(),
  content: z.string(),
  status: z.string().default("DELIVERED"),
  turnNumber: z.number().int(),
  gameDate: z.string(),
  createdAt: z.string().optional(),
});

export const SaveArchiveCouncilMessageSchema = z.object({
  senderCode: z.string(),
  senderName: z.string(),
  senderRole: z.string(),
  content: z.string(),
  stance: NullableString,
  status: z.string().default("DELIVERED"),
  turnNumber: z.number().int(),
  gameDate: z.string(),
  createdAt: z.string().optional(),
});

export const SaveArchiveCouncilSchema = z.object({
  title: z.string(),
  topic: z.string(),
  councilType: z.string().default("COUNCIL"),
  initiatorCode: z.string(),
  participantCodes: z.string(),
  status: z.string().default("OPEN"),
  turnNumber: z.number().int(),
  gameDate: z.string(),
  createdAt: z.string().optional(),
  messages: z.array(SaveArchiveCouncilMessageSchema).default([]),
});

export const SaveArchiveMapMarkerSchema = z.object({
  countryCode: z.string(),
  regionId: NullableString,
  cityName: NullableString,
  title: z.string(),
  description: z.string(),
  category: z.string().default("INDUSTRY"),
  status: z.string().default("ACTIVE"),
  level: z.number().int().default(1),
  lat: z.number(),
  lng: z.number(),
  turnNumber: z.number().int(),
  gameDate: z.string(),
  isAnimated: z.boolean().default(true),
  createdAt: z.string().optional(),
});

export const SaveArchiveAdvisorChatSchema = z.object({
  senderRole: z.string(),
  senderName: z.string(),
  content: z.string(),
  suggestedOrdersJson: NullableString,
  status: z.string().default("DELIVERED"),
  turnNumber: z.number().int(),
  gameDate: z.string(),
  createdAt: z.string().optional(),
});

export const SaveArchiveSnapshotSchema = z.object({
  turnNumber: z.number().int(),
  gameDate: z.string(),
  summary: z.string(),
  stateJson: z.string(),
  createdAt: z.string().optional(),
});

export const SaveArchiveSchema = z.object({
  format: z.literal("mur4history-save"),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  meta: z.object({
    originalSessionId: z.string().optional(),
    sessionName: z.string(),
    scenarioTitle: z.string(),
    scenarioEra: z.string().default(""),
    playerCountryCode: NullableString,
    playerCountryName: NullableString,
    currentDate: z.string(),
    turnNumber: z.number().int(),
    difficulty: z.string().default("NORMAL"),
  }),
  scenario: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    title: z.string(),
    era: z.string(),
    startDate: z.string(),
    turnIntervalMonths: z.number().int().default(3),
    description: z.string(),
    isPreset: z.boolean().default(false),
    configJson: z.string(),
  }),
  session: z.object({
    name: z.string().min(1),
    playerCountryCode: NullableString,
    currentDate: z.string().min(1),
    turnNumber: z.number().int().min(1),
    globalTension: z.number().int().min(0).max(100),
    difficulty: z.string().default("NORMAL"),
    timeJumpInterval: z.string().default("SCENARIO_DEFAULT"),
    awaitingAiSimulation: z.boolean().default(false),
  }),
  countries: z.array(SaveArchiveCountrySchema),
  regions: z.array(SaveArchiveRegionSchema),
  diplomacies: z.array(SaveArchiveDiplomacySchema).default([]),
  orders: z.array(SaveArchiveOrderSchema).default([]),
  events: z.array(SaveArchiveEventSchema).default([]),
  messages: z.array(SaveArchiveDiplomaticMessageSchema).default([]),
  leaderChats: z.array(SaveArchiveLeaderChatSchema).default([]),
  councils: z.array(SaveArchiveCouncilSchema).default([]),
  mapMarkers: z.array(SaveArchiveMapMarkerSchema).default([]),
  advisorChats: z.array(SaveArchiveAdvisorChatSchema).default([]),
  snapshots: z.array(SaveArchiveSnapshotSchema).default([]),
});

export type Mur4SaveArchive = z.infer<typeof SaveArchiveSchema>;

/** Build a clean filesystem-safe `.mur4history.json` save filename. */
export function buildSaveFilename(archive: Mur4SaveArchive): string {
  const country = (archive.meta.playerCountryCode || "global")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const nameSlug = archive.meta.sessionName
    .toLowerCase()
    .replace(/[çğıöşü]/g, (ch) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[ch] ?? ch)
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const label = nameSlug || "kayit";
  return `mur4history-${country}-tur-${archive.session.turnNumber}-${label}.mur4history.json`;
}

export function formatBytesTr(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
