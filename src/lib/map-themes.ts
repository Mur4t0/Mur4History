export type MapThemeId =
  | "pax_atlas"
  | "mur4_classic"
  | "pax_satellite_terrain"
  | "victoria_parchment"
  | "hoi4_iron"
  | "defcon_radar"
  | "nautical_portolan"
  | "midnight_lights"
  | "cyber_holomap"
  | "newsprint_chronicle"
  | "nordic_minimal"
  | "imperial_crimson"
  | "blueprint_architect"
  | "amber_command";

export type MapPatternKind =
  | "none"
  | "ocean-ripple"
  | "parchment"
  | "grid-tactical"
  | "blueprint"
  | "halftone";

export interface MapThemeDefinition {
  id: MapThemeId;
  name: string;
  subtitle: string;
  badge: string;
  previewColors: [string, string, string];
  oceanColor: string;
  oceanPattern: MapPatternKind;
  oceanPatternOpacity: number;
  physicalRasterEnabled: boolean;
  physicalBrightnessMin: number;
  physicalBrightnessMax: number;
  physicalContrast: number;
  physicalSaturation: number;
  physicalHueRotate: number;
  physicalOpacity: number;
  landTexture: MapPatternKind;
  landTextureOpacity: number;
  landFillOpacity: number;
  coastalGlowColor: string;
  coastalGlowWidth: number;
  coastalGlowBlur: number;
  coastalGlowOpacity: number;
  countryBorderColor: string;
  countryBorderWidth: number;
  countryHighlightBorderColor: string;
  provinceBorderColor: string;
  provinceBorderOpacity: number;
  antarcticaColor: string;
  antarcticaOpacity: number;
  labelColor: string;
  labelHaloColor: string;
  labelHaloWidth: number;
  labelLetterSpacing: number;
  defaultCurvedLabels: boolean;
  vignetteCss: string;
}

export const MAP_THEMES: MapThemeDefinition[] = [
  {
    id: "pax_atlas",
    name: "Pax Imperial Atlas",
    subtitle: "Derin safir okyanus, kıyı parıltısı ve kavisli imparatorluk yazıları",
    badge: "Önerilen • Pax Tarzı",
    previewColors: ["#091f52", "#2d6a4f", "#d97706"],
    oceanColor: "#081c4a",
    oceanPattern: "ocean-ripple",
    oceanPatternOpacity: 0.34,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.04,
    physicalBrightnessMax: 0.62,
    physicalContrast: 0.32,
    physicalSaturation: 0.38,
    physicalHueRotate: 8,
    physicalOpacity: 0.92,
    landTexture: "parchment",
    landTextureOpacity: 0.12,
    landFillOpacity: 0.78,
    coastalGlowColor: "#4da3ff",
    coastalGlowWidth: 5.5,
    coastalGlowBlur: 4.5,
    coastalGlowOpacity: 0.36,
    countryBorderColor: "#050911",
    countryBorderWidth: 1.45,
    countryHighlightBorderColor: "#f8fafc",
    provinceBorderColor: "rgba(9, 14, 24, 0.58)",
    provinceBorderOpacity: 0.72,
    antarcticaColor: "#5b7999",
    antarcticaOpacity: 0.54,
    labelColor: "rgba(252, 252, 255, 0.96)",
    labelHaloColor: "rgba(5, 9, 18, 0.96)",
    labelHaloWidth: 2.3,
    labelLetterSpacing: 0.26,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 110px rgba(2, 6, 18, 0.72)",
  },
  {
    id: "mur4_classic",
    name: "Mur4History Klasik",
    subtitle: "Önceki varsayılan fiziksel-siyasi koyu atlas görünümü",
    badge: "Orijinal Hal",
    previewColors: ["#08142c", "#1e3a5f", "#eab308"],
    oceanColor: "#08142c",
    oceanPattern: "none",
    oceanPatternOpacity: 0,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.0,
    physicalBrightnessMax: 0.44,
    physicalContrast: 0.36,
    physicalSaturation: 0.22,
    physicalHueRotate: 6,
    physicalOpacity: 1.0,
    landTexture: "none",
    landTextureOpacity: 0,
    landFillOpacity: 0.65,
    coastalGlowColor: "#38bdf8",
    coastalGlowWidth: 2.0,
    coastalGlowBlur: 2.0,
    coastalGlowOpacity: 0.1,
    countryBorderColor: "#060b14",
    countryBorderWidth: 1.2,
    countryHighlightBorderColor: "#f8fafc",
    provinceBorderColor: "rgba(11, 17, 30, 0.55)",
    provinceBorderOpacity: 0.75,
    antarcticaColor: "#4f657d",
    antarcticaOpacity: 0.46,
    labelColor: "rgba(248, 250, 252, 0.92)",
    labelHaloColor: "rgba(5, 8, 15, 0.92)",
    labelHaloWidth: 2.0,
    labelLetterSpacing: 0.14,
    defaultCurvedLabels: false,
    vignetteCss: "inset 0 0 90px rgba(3, 7, 18, 0.65)",
  },
  {
    id: "pax_satellite_terrain",
    name: "Fiziki Kabartma & Topografya",
    subtitle: "Dağ sıraları, platolar ve kıta sahanlıklarını öne çıkaran kabartma harita",
    badge: "Topografik",
    previewColors: ["#0b2f52", "#4c7c59", "#a3b18a"],
    oceanColor: "#092542",
    oceanPattern: "ocean-ripple",
    oceanPatternOpacity: 0.28,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.08,
    physicalBrightnessMax: 0.82,
    physicalContrast: 0.45,
    physicalSaturation: 0.42,
    physicalHueRotate: 0,
    physicalOpacity: 1.0,
    landTexture: "none",
    landTextureOpacity: 0,
    landFillOpacity: 0.52,
    coastalGlowColor: "#38d9f5",
    coastalGlowWidth: 7.0,
    coastalGlowBlur: 6.0,
    coastalGlowOpacity: 0.3,
    countryBorderColor: "#0b111c",
    countryBorderWidth: 1.35,
    countryHighlightBorderColor: "#fde68a",
    provinceBorderColor: "rgba(15, 23, 42, 0.5)",
    provinceBorderOpacity: 0.65,
    antarcticaColor: "#7892ad",
    antarcticaOpacity: 0.58,
    labelColor: "#ffffff",
    labelHaloColor: "rgba(6, 10, 18, 0.95)",
    labelHaloWidth: 2.4,
    labelLetterSpacing: 0.24,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 95px rgba(4, 10, 22, 0.55)",
  },
  {
    id: "victoria_parchment",
    name: "Victoria Parşömen (1836)",
    subtitle: "Eskitilmiş antik kağıt denizler, mürekkep sınırlar ve klasik haritacılık",
    badge: "Tarihsel",
    previewColors: ["#cbb893", "#7f4f24", "#9b2226"],
    oceanColor: "#bcae8a",
    oceanPattern: "parchment",
    oceanPatternOpacity: 0.58,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.35,
    physicalBrightnessMax: 0.88,
    physicalContrast: 0.18,
    physicalSaturation: -0.65,
    physicalHueRotate: 28,
    physicalOpacity: 0.32,
    landTexture: "parchment",
    landTextureOpacity: 0.34,
    landFillOpacity: 0.68,
    coastalGlowColor: "#785735",
    coastalGlowWidth: 4.0,
    coastalGlowBlur: 3.0,
    coastalGlowOpacity: 0.35,
    countryBorderColor: "#2b1b0e",
    countryBorderWidth: 1.4,
    countryHighlightBorderColor: "#7f1d1d",
    provinceBorderColor: "rgba(59, 40, 20, 0.42)",
    provinceBorderOpacity: 0.6,
    antarcticaColor: "#dfd3b9",
    antarcticaOpacity: 0.72,
    labelColor: "#23150a",
    labelHaloColor: "rgba(235, 223, 198, 0.9)",
    labelHaloWidth: 2.0,
    labelLetterSpacing: 0.24,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 130px rgba(42, 27, 12, 0.52)",
  },
  {
    id: "hoi4_iron",
    name: "Demir Fırtına (Harekât Odası)",
    subtitle: "Koyu çelik okyanus, mat askerî renkler ve keskin cephe çizgileri",
    badge: "Strateji",
    previewColors: ["#11161d", "#3f4d36", "#b45309"],
    oceanColor: "#0e1319",
    oceanPattern: "grid-tactical",
    oceanPatternOpacity: 0.18,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.0,
    physicalBrightnessMax: 0.34,
    physicalContrast: 0.42,
    physicalSaturation: -0.45,
    physicalHueRotate: 0,
    physicalOpacity: 0.85,
    landTexture: "halftone",
    landTextureOpacity: 0.12,
    landFillOpacity: 0.72,
    coastalGlowColor: "#64748b",
    coastalGlowWidth: 3.5,
    coastalGlowBlur: 2.5,
    coastalGlowOpacity: 0.32,
    countryBorderColor: "#040608",
    countryBorderWidth: 1.65,
    countryHighlightBorderColor: "#f59e0b",
    provinceBorderColor: "rgba(15, 23, 42, 0.7)",
    provinceBorderOpacity: 0.82,
    antarcticaColor: "#334155",
    antarcticaOpacity: 0.58,
    labelColor: "#f1f5f9",
    labelHaloColor: "rgba(4, 6, 9, 0.96)",
    labelHaloWidth: 2.4,
    labelLetterSpacing: 0.2,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 120px rgba(0, 0, 0, 0.78)",
  },
  {
    id: "defcon_radar",
    name: "DEFCON 1962 Nükleer Radar",
    subtitle: "Soğuk Savaş komuta radarı, fosfor yeşili kıyılar ve koordinat ızgarası",
    badge: "Soğuk Savaş",
    previewColors: ["#03140f", "#065f46", "#34d399"],
    oceanColor: "#03120e",
    oceanPattern: "grid-tactical",
    oceanPatternOpacity: 0.48,
    physicalRasterEnabled: false,
    physicalBrightnessMin: 0,
    physicalBrightnessMax: 0.25,
    physicalContrast: 0.2,
    physicalSaturation: -0.8,
    physicalHueRotate: 120,
    physicalOpacity: 0,
    landTexture: "grid-tactical",
    landTextureOpacity: 0.16,
    landFillOpacity: 0.44,
    coastalGlowColor: "#10b981",
    coastalGlowWidth: 4.5,
    coastalGlowBlur: 3.5,
    coastalGlowOpacity: 0.55,
    countryBorderColor: "#10b981",
    countryBorderWidth: 1.15,
    countryHighlightBorderColor: "#fde047",
    provinceBorderColor: "rgba(16, 185, 129, 0.28)",
    provinceBorderOpacity: 0.5,
    antarcticaColor: "#063b2d",
    antarcticaOpacity: 0.45,
    labelColor: "#a7f3d0",
    labelHaloColor: "rgba(2, 16, 12, 0.95)",
    labelHaloWidth: 2.0,
    labelLetterSpacing: 0.28,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 120px rgba(0, 12, 8, 0.82)",
  },
  {
    id: "nautical_portolan",
    name: "1444 Portolan Deniz Haritası",
    subtitle: "Altın yaldızlı kıyılar ve Rönesans ultramarin deniz atlası",
    badge: "Klasik",
    previewColors: ["#122b44", "#8a5a2b", "#eab308"],
    oceanColor: "#122a42",
    oceanPattern: "parchment",
    oceanPatternOpacity: 0.26,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.05,
    physicalBrightnessMax: 0.48,
    physicalContrast: 0.25,
    physicalSaturation: 0.15,
    physicalHueRotate: 12,
    physicalOpacity: 0.72,
    landTexture: "parchment",
    landTextureOpacity: 0.22,
    landFillOpacity: 0.78,
    coastalGlowColor: "#e8b954",
    coastalGlowWidth: 4.5,
    coastalGlowBlur: 3.5,
    coastalGlowOpacity: 0.42,
    countryBorderColor: "#1e160d",
    countryBorderWidth: 1.5,
    countryHighlightBorderColor: "#fde047",
    provinceBorderColor: "rgba(38, 28, 16, 0.5)",
    provinceBorderOpacity: 0.65,
    antarcticaColor: "#637a91",
    antarcticaOpacity: 0.5,
    labelColor: "#fef3c7",
    labelHaloColor: "rgba(24, 17, 9, 0.95)",
    labelHaloWidth: 2.2,
    labelLetterSpacing: 0.24,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 115px rgba(8, 12, 22, 0.72)",
  },
  {
    id: "midnight_lights",
    name: "Gece Uydusu (Karanlık Kıta)",
    subtitle: "Zifiri okyanus, koyu kara kütleleri ve parlayan altın sınır hatları",
    badge: "Gece Modu",
    previewColors: ["#02040a", "#1e293b", "#f59e0b"],
    oceanColor: "#020409",
    oceanPattern: "ocean-ripple",
    oceanPatternOpacity: 0.15,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.0,
    physicalBrightnessMax: 0.24,
    physicalContrast: 0.4,
    physicalSaturation: -0.55,
    physicalHueRotate: 0,
    physicalOpacity: 0.68,
    landTexture: "none",
    landTextureOpacity: 0,
    landFillOpacity: 0.42,
    coastalGlowColor: "#38bdf8",
    coastalGlowWidth: 4.5,
    coastalGlowBlur: 4.0,
    coastalGlowOpacity: 0.42,
    countryBorderColor: "#eab308",
    countryBorderWidth: 1.15,
    countryHighlightBorderColor: "#ffffff",
    provinceBorderColor: "rgba(148, 163, 184, 0.24)",
    provinceBorderOpacity: 0.45,
    antarcticaColor: "#1e293b",
    antarcticaOpacity: 0.5,
    labelColor: "#f8fafc",
    labelHaloColor: "rgba(2, 4, 9, 0.98)",
    labelHaloWidth: 2.4,
    labelLetterSpacing: 0.22,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 130px rgba(0, 0, 0, 0.85)",
  },
  {
    id: "cyber_holomap",
    name: "2077 Siber Holomasa",
    subtitle: "Gece moru okyanus, neon camgöbeği kıyılar ve dijital grid",
    badge: "Fütüristik",
    previewColors: ["#08051a", "#7e22ce", "#06b6d4"],
    oceanColor: "#08051a",
    oceanPattern: "blueprint",
    oceanPatternOpacity: 0.4,
    physicalRasterEnabled: false,
    physicalBrightnessMin: 0,
    physicalBrightnessMax: 0.2,
    physicalContrast: 0.1,
    physicalSaturation: 0,
    physicalHueRotate: 0,
    physicalOpacity: 0,
    landTexture: "grid-tactical",
    landTextureOpacity: 0.14,
    landFillOpacity: 0.62,
    coastalGlowColor: "#22d3ee",
    coastalGlowWidth: 5.0,
    coastalGlowBlur: 4.5,
    coastalGlowOpacity: 0.5,
    countryBorderColor: "#c084fc",
    countryBorderWidth: 1.25,
    countryHighlightBorderColor: "#22d3ee",
    provinceBorderColor: "rgba(192, 132, 252, 0.28)",
    provinceBorderOpacity: 0.5,
    antarcticaColor: "#1e1b4b",
    antarcticaOpacity: 0.55,
    labelColor: "#ecfeff",
    labelHaloColor: "rgba(8, 5, 26, 0.96)",
    labelHaloWidth: 2.2,
    labelLetterSpacing: 0.26,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 110px rgba(4, 2, 18, 0.8)",
  },
  {
    id: "newsprint_chronicle",
    name: "Tarihsel Gazete Gravürü",
    subtitle: "Baskı mürekkebi, krem gazete kağıdı ve oyma çizgili editöryel harita",
    badge: "Editöryel",
    previewColors: ["#e2dcd0", "#4b5563", "#111827"],
    oceanColor: "#ded8ca",
    oceanPattern: "halftone",
    oceanPatternOpacity: 0.42,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.42,
    physicalBrightnessMax: 0.92,
    physicalContrast: 0.22,
    physicalSaturation: -0.95,
    physicalHueRotate: 0,
    physicalOpacity: 0.28,
    landTexture: "parchment",
    landTextureOpacity: 0.28,
    landFillOpacity: 0.54,
    coastalGlowColor: "#1f2937",
    coastalGlowWidth: 3.0,
    coastalGlowBlur: 2.0,
    coastalGlowOpacity: 0.3,
    countryBorderColor: "#111827",
    countryBorderWidth: 1.45,
    countryHighlightBorderColor: "#b91c1c",
    provinceBorderColor: "rgba(31, 41, 55, 0.4)",
    provinceBorderOpacity: 0.62,
    antarcticaColor: "#f3efe6",
    antarcticaOpacity: 0.82,
    labelColor: "#111827",
    labelHaloColor: "rgba(243, 239, 230, 0.94)",
    labelHaloWidth: 2.1,
    labelLetterSpacing: 0.22,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 90px rgba(35, 30, 22, 0.35)",
  },
  {
    id: "nordic_minimal",
    name: "İskandinav Minimalist (Açık)",
    subtitle: "Ferah açık buz mavisi denizler, temiz mat renkler ve ince sınırlar",
    badge: "Açık Tema",
    previewColors: ["#cbd9e6", "#64748b", "#0f172a"],
    oceanColor: "#cbd9e6",
    oceanPattern: "ocean-ripple",
    oceanPatternOpacity: 0.14,
    physicalRasterEnabled: false,
    physicalBrightnessMin: 0.4,
    physicalBrightnessMax: 0.9,
    physicalContrast: 0.1,
    physicalSaturation: -0.2,
    physicalHueRotate: 0,
    physicalOpacity: 0,
    landTexture: "none",
    landTextureOpacity: 0,
    landFillOpacity: 0.82,
    coastalGlowColor: "#64748b",
    coastalGlowWidth: 3.2,
    coastalGlowBlur: 2.5,
    coastalGlowOpacity: 0.28,
    countryBorderColor: "#1e293b",
    countryBorderWidth: 1.2,
    countryHighlightBorderColor: "#2563eb",
    provinceBorderColor: "rgba(51, 65, 85, 0.32)",
    provinceBorderOpacity: 0.55,
    antarcticaColor: "#f1f5f9",
    antarcticaOpacity: 0.9,
    labelColor: "#0f172a",
    labelHaloColor: "rgba(255, 255, 255, 0.92)",
    labelHaloWidth: 2.1,
    labelLetterSpacing: 0.2,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 80px rgba(15, 23, 42, 0.2)",
  },
  {
    id: "imperial_crimson",
    name: "Napolyon Kızıl Alacakaranlık",
    subtitle: "Bordo-mor dramatik okyanus, şampanya rengi kıyı hattı ve imparatorluk tonu",
    badge: "İmparatorluk",
    previewColors: ["#1b0d1b", "#7c2d12", "#f59e0b"],
    oceanColor: "#190c1a",
    oceanPattern: "ocean-ripple",
    oceanPatternOpacity: 0.28,
    physicalRasterEnabled: true,
    physicalBrightnessMin: 0.0,
    physicalBrightnessMax: 0.4,
    physicalContrast: 0.36,
    physicalSaturation: 0.15,
    physicalHueRotate: 290,
    physicalOpacity: 0.78,
    landTexture: "parchment",
    landTextureOpacity: 0.14,
    landFillOpacity: 0.76,
    coastalGlowColor: "#f59e0b",
    coastalGlowWidth: 4.5,
    coastalGlowBlur: 3.5,
    coastalGlowOpacity: 0.32,
    countryBorderColor: "#0b050b",
    countryBorderWidth: 1.5,
    countryHighlightBorderColor: "#fde68a",
    provinceBorderColor: "rgba(18, 9, 18, 0.58)",
    provinceBorderOpacity: 0.7,
    antarcticaColor: "#4a334a",
    antarcticaOpacity: 0.55,
    labelColor: "#fef3c7",
    labelHaloColor: "rgba(16, 7, 16, 0.95)",
    labelHaloWidth: 2.3,
    labelLetterSpacing: 0.25,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 115px rgba(10, 3, 12, 0.75)",
  },
  {
    id: "blueprint_architect",
    name: "Genelkurmay Mavi Planı",
    subtitle: "Teknik mimari plan ızgarası, beyaz vektör sınırlar ve Prusya mavisi",
    badge: "Teknik Plan",
    previewColors: ["#0b2b52", "#1d4ed8", "#e0f2fe"],
    oceanColor: "#0a274a",
    oceanPattern: "blueprint",
    oceanPatternOpacity: 0.52,
    physicalRasterEnabled: false,
    physicalBrightnessMin: 0,
    physicalBrightnessMax: 0.2,
    physicalContrast: 0.1,
    physicalSaturation: 0,
    physicalHueRotate: 0,
    physicalOpacity: 0,
    landTexture: "blueprint",
    landTextureOpacity: 0.18,
    landFillOpacity: 0.42,
    coastalGlowColor: "#bae6fd",
    coastalGlowWidth: 3.5,
    coastalGlowBlur: 2.5,
    coastalGlowOpacity: 0.5,
    countryBorderColor: "#e0f2fe",
    countryBorderWidth: 1.25,
    countryHighlightBorderColor: "#fde047",
    provinceBorderColor: "rgba(186, 230, 253, 0.35)",
    provinceBorderOpacity: 0.55,
    antarcticaColor: "#143b69",
    antarcticaOpacity: 0.55,
    labelColor: "#f0f9ff",
    labelHaloColor: "rgba(8, 28, 56, 0.94)",
    labelHaloWidth: 2.0,
    labelLetterSpacing: 0.24,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 100px rgba(4, 15, 34, 0.65)",
  },
  {
    id: "amber_command",
    name: "Amber Komuta Monitörü",
    subtitle: "Retro kehribar CRT terminali, sıcak altın kıyılar ve taktik kontrast",
    badge: "Retro CRT",
    previewColors: ["#140c03", "#78350f", "#fbbf24"],
    oceanColor: "#140b03",
    oceanPattern: "grid-tactical",
    oceanPatternOpacity: 0.36,
    physicalRasterEnabled: false,
    physicalBrightnessMin: 0,
    physicalBrightnessMax: 0.2,
    physicalContrast: 0.1,
    physicalSaturation: 0,
    physicalHueRotate: 0,
    physicalOpacity: 0,
    landTexture: "halftone",
    landTextureOpacity: 0.14,
    landFillOpacity: 0.56,
    coastalGlowColor: "#f59e0b",
    coastalGlowWidth: 4.0,
    coastalGlowBlur: 3.0,
    coastalGlowOpacity: 0.46,
    countryBorderColor: "#fbbf24",
    countryBorderWidth: 1.15,
    countryHighlightBorderColor: "#ffffff",
    provinceBorderColor: "rgba(251, 191, 36, 0.26)",
    provinceBorderOpacity: 0.48,
    antarcticaColor: "#2d1a07",
    antarcticaOpacity: 0.5,
    labelColor: "#fef3c7",
    labelHaloColor: "rgba(18, 10, 2, 0.96)",
    labelHaloWidth: 2.1,
    labelLetterSpacing: 0.25,
    defaultCurvedLabels: true,
    vignetteCss: "inset 0 0 120px rgba(10, 5, 0, 0.85)",
  },
];

export const MAP_THEME_BY_ID: Record<MapThemeId, MapThemeDefinition> =
  Object.fromEntries(MAP_THEMES.map((t) => [t.id, t])) as Record<
    MapThemeId,
    MapThemeDefinition
  >;

export interface MapAppearanceSettings {
  themeId: MapThemeId;
  showTerrainRelief: boolean;
  showCurvedLabels: boolean;
  showCoastalGlow: boolean;
  showProvinceBorders: boolean;
}

export interface GameAudioSettings {
  musicEnabled: boolean;
  trackId: string;
  volume: number; // 0 to 100
}

export interface GameSettings {
  map: MapAppearanceSettings;
  audio: GameAudioSettings;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  map: {
    themeId: "pax_atlas",
    showTerrainRelief: true,
    showCurvedLabels: true,
    showCoastalGlow: true,
    showProvinceBorders: true,
  },
  audio: {
    musicEnabled: true,
    trackId: "peace_dawn",
    volume: 35,
  },
};

const SETTINGS_STORAGE_KEY = "mur4history_settings_v1";

export function loadGameSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_GAME_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const themeId =
      parsed.map?.themeId && MAP_THEME_BY_ID[parsed.map.themeId]
        ? parsed.map.themeId
        : DEFAULT_GAME_SETTINGS.map.themeId;

    return {
      map: {
        themeId,
        showTerrainRelief:
          parsed.map?.showTerrainRelief ??
          DEFAULT_GAME_SETTINGS.map.showTerrainRelief,
        showCurvedLabels:
          parsed.map?.showCurvedLabels ??
          DEFAULT_GAME_SETTINGS.map.showCurvedLabels,
        showCoastalGlow:
          parsed.map?.showCoastalGlow ??
          DEFAULT_GAME_SETTINGS.map.showCoastalGlow,
        showProvinceBorders:
          parsed.map?.showProvinceBorders ??
          DEFAULT_GAME_SETTINGS.map.showProvinceBorders,
      },
      audio: {
        musicEnabled:
          parsed.audio?.musicEnabled ?? DEFAULT_GAME_SETTINGS.audio.musicEnabled,
        trackId:
          typeof parsed.audio?.trackId === "string"
            ? parsed.audio.trackId
            : DEFAULT_GAME_SETTINGS.audio.trackId,
        volume:
          typeof parsed.audio?.volume === "number"
            ? Math.max(0, Math.min(100, parsed.audio.volume))
            : DEFAULT_GAME_SETTINGS.audio.volume,
      },
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues
  }
}
