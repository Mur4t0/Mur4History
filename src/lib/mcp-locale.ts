import {
  type AppLocale,
  getCountryDisplayName,
  getDifficultyDisplay,
  getScenarioDisplay,
  getTimeJumpDisplay,
} from "@/lib/i18n";
import { DIFFICULTY_META, TIME_JUMP_LABELS } from "@/lib/utils";

const DIFFICULTY_AI_RULES_EN: Record<string, string> = {
  VERY_EASY:
    "DIFFICULTY = VERY EASY (Sandbox): Accept the player's diplomatic proposals, alliances, and territorial demands at a very high rate (90%+). Keep failure penalties mild; reject only physically impossible sci-fi commands.",
  EASY:
    "DIFFICULTY = EASY: AI nations approach player proposals favorably (~75% acceptance rate). Forgive minor preparation gaps, but still react proportionally to overt hostility.",
  NORMAL:
    "DIFFICULTY = NORMAL: Apply balanced geopolitical realism. Treaty and alliance acceptance stays around ~50% depending on mutual interest and preparation. Neighbors issue protests or councils against aggressive expansion.",
  HARD:
    "DIFFICULTY = HARD: AI nations fiercely defend their interests. Reject one-sided or under-prepared treaties 70%+ of the time (20-35% acceptance). Provocative moves trigger immediate protest dispatches and 'convene_diplomatic_council' coalitions whenever 2+ countries are alarmed.",
  IMPOSSIBLE:
    "DIFFICULTY = IMPOSSIBLE (Relentless Realism & Historical Inertia): Great powers defend the status quo to the last. Reject player-slanted deals almost always (5-15% acceptance unless backed by major concessions or decisive war victory). Punish poorly prepared military adventures with heavy losses and domestic instability, and launch multi-nation sanction/coalition councils ('convene_diplomatic_council') at the slightest aggression.",
};

export function getMcpDifficultyContext(
  difficulty: string,
  locale: AppLocale
) {
  const base = DIFFICULTY_META[difficulty] ?? DIFFICULTY_META.NORMAL;
  const localized = getDifficultyDisplay(difficulty, locale, base);
  const aiPromptRules =
    locale === "en"
      ? DIFFICULTY_AI_RULES_EN[difficulty] ?? DIFFICULTY_AI_RULES_EN.NORMAL
      : base.aiPromptRules;

  return {
    label: localized.label,
    treatyAcceptRate: localized.treatyAcceptRate,
    aiPromptRules,
  };
}

export function getMcpLanguageDirective(locale: AppLocale): string {
  if (locale === "en") {
    return "IMPORTANT LANGUAGE RULE: The player's UI language is ENGLISH. Write ALL world newspaper headlines and articles, diplomatic messages, foreign leader chat replies, multilateral council debates, AI advisor responses, suggested order cards, map marker titles/descriptions, and turn summaries in NATURAL ENGLISH.";
  }
  return "ÖNEMLİ DİL KURALI: Oyuncunun arayüz dili TÜRKÇE. Tüm dünya gazetesi manşet ve haberlerini, diplomatik telgrafları, bire bir lider sohbeti yanıtlarını, çok uluslu konsey konuşmalarını, AI danışman analizlerini, öneri kartlarını, harita tesis başlık/açıklamalarını ve tur özetlerini DOĞAL TÜRKÇE olarak üret.";
}

export function localizeWorldStateFields(params: {
  locale: AppLocale;
  difficulty: string;
  timeJumpInterval: string;
  scenario: { id: string; slug?: string; title: string; era: string };
  playerCountryCode: string | null;
  playerCountryRawName: string | null;
}) {
  const {
    locale,
    difficulty,
    timeJumpInterval,
    scenario,
    playerCountryCode,
    playerCountryRawName,
  } = params;
  const diff = getMcpDifficultyContext(difficulty, locale);
  const scen = getScenarioDisplay(scenario, locale);
  const timeJumpLabel = getTimeJumpDisplay(
    timeJumpInterval,
    locale,
    TIME_JUMP_LABELS
  );
  const playerCountryName =
    playerCountryCode && playerCountryRawName
      ? getCountryDisplayName(playerCountryCode, playerCountryRawName, locale)
      : playerCountryCode;

  return {
    difficultyLabel: diff.label,
    difficultyTreatyAcceptanceRate: diff.treatyAcceptRate,
    difficultyRules: diff.aiPromptRules,
    timeJumpLabel,
    scenarioTitle: scen.title,
    scenarioEra: scen.era,
    playerCountryName,
  };
}

export interface McpToolInstructionSet {
  advanceTurn: string;
  replyLeaderChat: string;
  replyCouncil: string;
  replyAdvisorChat: string;
  defaultAdvisorTitle: string;
  waitImmediateSummary: string;
  waitImmediateInstruction: string;
  waitReceivedInstruction: string;
  waitContinueInstruction: string;
  waitingProgress: string;
  readContextNote: string;
  noSessionError: string;
  unknownLabel: string;
  playerCompletedTurnSummary: string;
  leaderChatTriggerSummary: (targetCode: string, preview: string) => string;
  councilCreateTriggerSummary: (
    title: string,
    topic: string,
    preview: string
  ) => string;
  councilMsgTriggerSummary: (title: string, preview: string) => string;
  advisorChatTriggerSummary: (preview: string) => string;
  defaultFacilityTitle: (place: string) => string;
  defaultFacilityDesc: (place: string) => string;
}

const TOOL_INSTRUCTIONS_TR: McpToolInstructionSet = {
  advanceTurn:
    "Tur ilerletildi. Bağlantıyı açık tutmak ve oyuncunun bir sonraki hamle butonunu (Turu Tamamla / Lider Sohbeti / Konsey) otomatik yakalamak için DERHAL wait_for_player_action aracını çağır! Tüm anlatım ve yanıtları TÜRKÇE üret.",
  replyLeaderChat:
    "Lider yanıtı iletildi. Eğer işlenecek başka bekleyen emir/mesaj yoksa bağlantıyı açık tutmak için DERHAL wait_for_player_action aracını çağır!",
  replyCouncil:
    "Konsey yanıtları iletildi. Eğer işlenecek başka bekleyen emir/mesaj yoksa bağlantıyı açık tutmak için DERHAL wait_for_player_action aracını çağır!",
  replyAdvisorChat:
    "AI Danışman fikri/cevabı oyuncuya iletildi (tur ilerletilmedi). Oyuncunun yeni mesajını veya Turu Tamamla butonunu yakalamak için DERHAL wait_for_player_action aracını çağır!",
  defaultAdvisorTitle: "Başstratejist & Senaryo Danışmanı (MCP AI)",
  waitImmediateSummary:
    "Oturumda henüz yanıtlanmamış oyuncu hamlesi/sorusu hazır bekliyor.",
  waitImmediateInstruction:
    "OYUNCU HAMLESİ HAZIR! (Dil: TÜRKÇE — tüm yanıt ve olayları Türkçe üret.) 1) pendingAdvisorMessages varsa reply_advisor_chat ile stratejik fikir/öneri mesajı (ve suggested_orders) yanıtla — turu ilerletme! 2) pendingLeaderChats varsa reply_leader_chat ile yanıtla. 3) pendingCouncils varsa reply_diplomatic_council ile yanıtla. 4) awaitingTurn === true veya pendingOrders varsa emirleri simüle et (transfer_territory, manage_map_markers, update_country_stats, manage_diplomacy, convene_diplomatic_council, publish_world_event) ve advance_turn ile turu ilerlet. 5) TÜM İŞLEMLER BİTER BİTMEZ boşuna token yakmamak için DERHAL wait_for_player_action aracını çağırarak süresiz beklemeye geç!",
  waitReceivedInstruction:
    "OYUNCU WEB ARAYÜZÜNDE BUTONA BASTI! (Dil: TÜRKÇE — tüm yanıt ve olayları Türkçe üret.) 1) pendingAdvisorMessages varsa reply_advisor_chat ile sohbet yanıtı + suggested_orders ver (turu ilerletme!). 2) pendingLeaderChats varsa reply_leader_chat ile lider ağzından yanıtla. 3) pendingCouncils varsa reply_diplomatic_council ile konseyde tartış. 4) awaitingTurn === true ise emirleri simüle et ve en son advance_turn çağır. 5) İŞİN BİTER BİTMEZ süresiz beklemeye geçmek ve bağlantıyı açık tutmak için DERHAL tekrar wait_for_player_action aracını çağır!",
  waitContinueInstruction:
    "Bekleme zaman aşımı / kesinti oldu; tekrar wait_for_player_action (timeout_seconds=0) çağırarak süresiz beklemeye devam et.",
  waitingProgress: "Oyuncunun yeni hamlesi süresiz bekleniyor...",
  readContextNote:
    "Oyuncunun bir sonraki hamle butonunu canlı beklemek ve MCP bağlantısını açık tutmak için wait_for_player_action aracını (timeout_seconds=0) çağırın. Yanıt dili: TÜRKÇE.",
  noSessionError:
    "Henüz aktif bir oyun oturumu yok. Oyuncu tarayıcıdan bir senaryo başlattığında veya wait_for_player_action uyandığında oturum otomatik seçilecektir.",
  unknownLabel: "Bilinmiyor",
  playerCompletedTurnSummary:
    "Oyuncu 'Turu Tamamla (AI Simülasyonunu Başlat)' butonuna bastı.",
  leaderChatTriggerSummary: (targetCode, preview) =>
    `Oyuncu ${targetCode} liderine bire bir mesaj gönderdi: ${preview}`,
  councilCreateTriggerSummary: (title, topic, preview) =>
    `Oyuncu '${title}' konseyini kurdu (${topic}): ${preview}`,
  councilMsgTriggerSummary: (title, preview) =>
    `Oyuncu '${title}' konseyinde konuştu: ${preview}`,
  advisorChatTriggerSummary: (preview) =>
    `Oyuncu AI Danışman / Fikir Odası'nda soru sordu: ${preview}`,
  defaultFacilityTitle: (place) => `${place} Tesisi`,
  defaultFacilityDesc: (place) => `${place} bölgesinde stratejik faaliyet.`,
};

const TOOL_INSTRUCTIONS_EN: McpToolInstructionSet = {
  advanceTurn:
    "Turn advanced. Keep the connection open and catch the player's next click (Complete Turn / Leader Chat / Council) by IMMEDIATELY calling wait_for_player_action! Generate all narratives and replies in ENGLISH.",
  replyLeaderChat:
    "Leader reply delivered. If no other orders/messages are pending, IMMEDIATELY call wait_for_player_action to keep listening indefinitely!",
  replyCouncil:
    "Council responses posted. If no other orders/messages are pending, IMMEDIATELY call wait_for_player_action to keep listening indefinitely!",
  replyAdvisorChat:
    "AI Advisor response delivered to player (turn was NOT advanced). IMMEDIATELY call wait_for_player_action to listen for the player's next question or Complete Turn click!",
  defaultAdvisorTitle: "Chief Strategist & Scenario Advisor (MCP AI)",
  waitImmediateSummary:
    "Unanswered player orders or messages are already waiting in this session.",
  waitImmediateInstruction:
    "PLAYER ACTION READY! (Language: ENGLISH — generate all replies, headlines, markers, and summaries in ENGLISH.) 1) If pendingAdvisorMessages is non-empty, reply using reply_advisor_chat (with optional suggested_orders) — do NOT advance the turn! 2) If pendingLeaderChats has items, reply via reply_leader_chat. 3) If pendingCouncils has items, reply via reply_diplomatic_council. 4) If awaitingTurn === true or pendingOrders has items, simulate orders (transfer_territory, manage_map_markers, update_country_stats, manage_diplomacy, convene_diplomatic_council, publish_world_event) and finish with advance_turn. 5) As soon as everything is done, IMMEDIATELY call wait_for_player_action to enter zero-token indefinite standby!",
  waitReceivedInstruction:
    "PLAYER TRIGGERED ACTION FROM WEB UI! (Language: ENGLISH — write all outputs in ENGLISH.) 1) If pendingAdvisorMessages has messages, answer via reply_advisor_chat with suggested_orders (do NOT advance turn!). 2) If pendingLeaderChats has messages, reply in character via reply_leader_chat. 3) If pendingCouncils needs debate, respond via reply_diplomatic_council. 4) If awaitingTurn === true, simulate orders and call advance_turn at the end. 5) As soon as finished, IMMEDIATELY call wait_for_player_action again to keep the stream open!",
  waitContinueInstruction:
    "Wait heartbeat elapsed; immediately call wait_for_player_action (timeout_seconds=0) again to continue indefinite standby.",
  waitingProgress: "Waiting indefinitely for player's next action...",
  readContextNote:
    "Call wait_for_player_action (timeout_seconds=0) to wait live for the player's next click at zero idle token cost. Response language: ENGLISH.",
  noSessionError:
    "No active game session exists yet. Once the player starts a scenario in the browser or wait_for_player_action wakes up, the active session will be selected automatically.",
  unknownLabel: "Unknown",
  playerCompletedTurnSummary:
    "Player clicked 'Complete Turn (Start AI Simulation)'.",
  leaderChatTriggerSummary: (targetCode, preview) =>
    `Player sent a direct message to ${targetCode}'s leader: ${preview}`,
  councilCreateTriggerSummary: (title, topic, preview) =>
    `Player convened diplomatic council '${title}' (${topic}): ${preview}`,
  councilMsgTriggerSummary: (title, preview) =>
    `Player spoke in council '${title}': ${preview}`,
  advisorChatTriggerSummary: (preview) =>
    `Player asked a question in AI Advisor / Strategy Room: ${preview}`,
  defaultFacilityTitle: (place) => `${place} Facility`,
  defaultFacilityDesc: (place) => `Strategic installation in ${place}.`,
};

export function getMcpToolInstructions(
  locale: AppLocale
): McpToolInstructionSet {
  return locale === "en" ? TOOL_INSTRUCTIONS_EN : TOOL_INSTRUCTIONS_TR;
}

export function buildGameMasterDirectivePrompt(params: {
  locale: AppLocale;
  boundChannel: string;
  sessionId: string | null;
  worldState?: {
    difficulty: string;
    difficultyLabel: string;
    difficultyTreatyAcceptanceRate: string;
    difficultyRules: string;
    timeJumpInterval: string;
    scenario: { title: string; era: string; suggestedNextDate: string };
    currentDate: string;
    turnNumber: number;
    playerCountryName: string | null;
    playerCountryCode: string | null;
  };
  pendingOrdersCount?: number;
  playerFocus?: string;
}): string {
  const { locale, boundChannel, sessionId, worldState, pendingOrdersCount, playerFocus } =
    params;

  if (!sessionId || !worldState) {
    if (locale === "en") {
      const focusNote = playerFocus ? `\nAdditional Focus: ${playerFocus}` : "";
      return `You are the Head Game Master & World Simulation AI of **Mur4History** (Alternate History & Grand Strategy). Connection succeeded! There is currently no active game session in the database; once the player launches a scenario in the browser, call 'list_game_sessions' / 'read_game_context' to inspect the world, or immediately call 'wait_for_player_action' now to wait indefinitely at zero idle tokens. ${getMcpLanguageDirective("en")}${focusNote}`;
    }
    const focusNote = playerFocus ? `\nEk Odak: ${playerFocus}` : "";
    return `Sen Mur4History Alternatif Tarih & Büyük Strateji simülasyonunun baş Game Master yapay zekasısın. Bağlantı başarılı! Şu anda veritabanında aktif oyun oturumu yok; oyuncu tarayıcıdan bir senaryo başlattığında 'list_game_sessions' / 'read_game_context' çağırarak dünyayı oku veya şimdiden 'wait_for_player_action' ile süresiz beklemeye geç. ${getMcpLanguageDirective("tr")}${focusNote}`;
  }

  if (locale === "en") {
    const focusNote = playerFocus ? `\n\nExtra Turn Focus: ${playerFocus}` : "";
    return `You are the Head Game Master & World Simulation Engine of **Mur4History**.
${getMcpLanguageDirective("en")}

Active Session ID: ${sessionId}
Scenario: ${worldState.scenario.title} (${worldState.scenario.era})
Difficulty Mode: ${worldState.difficultyLabel} (${worldState.difficulty}) — Treaty Acceptance Rate: ${worldState.difficultyTreatyAcceptanceRate}
Difficulty Rule: ${worldState.difficultyRules}
Current Date: ${worldState.currentDate} | Turn: ${worldState.turnNumber} | Time Jump: ${worldState.timeJumpInterval} | Suggested Next Date: ${worldState.scenario.suggestedNextDate}
Player Country: ${worldState.playerCountryName ?? "Not selected yet"} (${worldState.playerCountryCode ?? "N/A"})
Pending Orders Count: ${pendingOrdersCount ?? 0}${focusNote}

MANDATORY GAME MASTER RULES:
1. INSPECT RESOURCES FIRST: Before simulating, read these 10 MCP Resources (or call read_game_context):
   - game://session/${boundChannel}/world-state
   - game://session/${boundChannel}/countries
   - game://session/${boundChannel}/map-ownership
   - game://session/${boundChannel}/map-markers (factories, bases, shipyards, R&D hubs, crises on the map)
   - game://session/${boundChannel}/pending-orders
   - game://session/${boundChannel}/chronicle-history
   - game://session/${boundChannel}/pending-leader-chats (direct 1-on-1 leader talks & nuclear sharing eligibility)
   - game://session/${boundChannel}/diplomatic-councils (multi-nation councils & coalitions)
   - game://session/${boundChannel}/advisor-chat (player's AI Strategy Advisor brainstorm room)
   - game://session/${boundChannel}/war-theater (live war probabilities, active sieges & battle fronts)

2. DIPLOMACY & RESISTANCE BY DIFFICULTY:
   - Always calibrate treaty, alliance, territorial demand, and ultimatum acceptance strictly according to the active **Difficulty Mode** (${worldState.difficultyLabel}).
   - Treat any \`NOTE_TO_AI\` directive in pending orders as backstage director guidance.

3. DISPUTES, PROTESTS & MULTILATERAL COUNCILS (CRITICAL):
   - When the player's orders collide with foreign interests or international norms:
     * **Single offended nation**: Reply as its leader via \`reply_leader_chat\` or \`send_diplomatic_message\` with sharp in-character diplomacy.
     * **Multiple nations (2+) concerned**: You MUST call \`convene_diplomatic_council\` to gather all involved leaders in one Council / Coalition table with opening statements.
   - Reply to threads in \`pending-leader-chats\` (\`awaiting_leader_reply: true\`) using \`reply_leader_chat\`, and councils in \`diplomatic-councils\` (\`awaiting_council_debate: true\`) using \`reply_diplomatic_council\`.

4. ANIMATED MAP FACILITIES & LANDMARKS (\`manage_map_markers\`):
   - Whenever the player or AI nations construct facilities in cities/regions (e.g., *"Build a defense plant in Ankara"*, *"Construct shipyards in Istanbul"*, *"Deploy border air defense"*, *"Host Berlin peace summit"*), encounter frontlines/crises, or upgrade/destroy facilities, ALWAYS call \`manage_map_markers\` with \`city_name\` or \`region_id\`, \`category\`, \`status\`, and \`level\` (1-5).

5. REALISM, NUCLEAR ARSENALS & TREATY SHARING:
   - Countries can ONLY launch \`launch_nuclear_strike\` if their \`nuclear_warheads\` count is > 0! Pre-1945 eras start at 0.
   - If the player talks to an allied nuclear power (under an \`ALLIANCE\` / mutual defense / nuclear umbrella treaty) via \`pending-leader-chats\` requesting nuclear weapons or deterrence support, evaluate strictly by Difficulty Mode & bilateral trust: you can transfer 1-3 warheads using \`transfer_nuclear_warheads\` or via \`reply_leader_chat\`'s \`transfer_nuclear_warheads\` parameter! If no qualifying alliance/treaty exists yet, have the foreign leader explain in-character that an Alliance / Defense Umbrella treaty must be signed first.
   - If the player orders something anachronistic or physically impossible (e.g., space lasers in 1936 or nuclear submarines in 1444), REJECT the project, apply treasury/stability penalties, and announce the setback via \`publish_world_event\`.

6. CHAIN REACTIONS, TOOL CALLS & NEWSPAPER GROUPING:
   - Simulate economic, military, domestic stability, \`infamy_delta\`, and neighborhood ripple effects across major powers.
   - Call \`transfer_territory\`, \`manage_map_markers\`, \`update_country_stats\`, \`manage_diplomacy\`, \`send_diplomatic_message\`, \`convene_diplomatic_council\` / \`reply_diplomatic_council\`, and \`publish_world_event\`.
   - NEWSPAPER GROUPING RULE: Instead of spamming 6 tiny articles per turn, bundle related events into 1-3 crisp, clearly categorized headlines (\`WAR\`, \`DIPLOMACY\`, \`ECONOMY\`, \`CRISIS\`, \`INTERNAL\`).
   - Once all updates are persisted, call \`advance_turn\` with the next date (${worldState.scenario.suggestedNextDate}) and turn summary; otherwise the UI remains in "Awaiting AI Simulation".

7. AI STRATEGY ADVISOR CHAT (\`reply_advisor_chat\`):
   - When \`awaiting_advisor_reply: true\` is present in \`advisor-chat\`, answer via \`reply_advisor_chat\` with strategic analysis and optional \`suggested_orders\` one-click cards. CRITICAL: Do NOT call \`advance_turn\` when only answering advisor or leader/council chats!

8. ZERO-TOKEN INDEFINITE STANDBY LOOP (\`wait_for_player_action\`):
   - Immediately after calling \`advance_turn\`, \`reply_leader_chat\`, \`reply_diplomatic_council\`, or \`reply_advisor_chat\` (or when nothing is pending), **IMMEDIATELY call \`wait_for_player_action\` with no arguments (default \`timeout_seconds=0\` = INDEFINITE WAIT)**.
   - It waits indefinitely without closing or burning tokens until the player clicks Complete Turn, Advisor, Leader, or Council Send in the web UI, then wakes up with full context.`;
  }

  const focusNote = playerFocus ? `\n\nEk Tur Odağı: ${playerFocus}` : "";
  return `Sen Mur4History evreninin baş Game Master (Oyun Yöneticisi / Simülasyon Motoru) yapay zekasısın.
${getMcpLanguageDirective("tr")}

Aktif Oturum ID: ${sessionId}
Senaryo: ${worldState.scenario.title} (${worldState.scenario.era})
Zorluk Modu: ${worldState.difficultyLabel} (${worldState.difficulty}) — Anlaşma Kabul Oranı: ${worldState.difficultyTreatyAcceptanceRate}
Zorluk Kuralı: ${worldState.difficultyRules}
Mevcut Tarih: ${worldState.currentDate} | Tur: ${worldState.turnNumber} | Zaman Atlama: ${worldState.timeJumpInterval} | Önerilen Sonraki Tarih: ${worldState.scenario.suggestedNextDate}
Oyuncu Ülkesi: ${worldState.playerCountryName ?? "Henüz seçilmedi"} (${worldState.playerCountryCode ?? "N/A"})
Bekleyen Emir Sayısı: ${pendingOrdersCount ?? 0}${focusNote}

ZORUNLU OYUN YÖNETİM KURALLARI:
1. ÖNCE KAYNAKLARI OKU: Simülasyona başlamadan önce mutlaka şu 10 MCP Resource'u oku:
   - game://session/${boundChannel}/world-state
   - game://session/${boundChannel}/countries
   - game://session/${boundChannel}/map-ownership
   - game://session/${boundChannel}/map-markers (haritada kurulu fabrikalar, üsler ve yerel kriz noktaları)
   - game://session/${boundChannel}/pending-orders
   - game://session/${boundChannel}/chronicle-history
   - game://session/${boundChannel}/pending-leader-chats (bire bir lider sohbetleri & nükleer paylaşım bilgisi)
   - game://session/${boundChannel}/diplomatic-councils (çok uluslu konseyler & koalisyon zirveleri)
   - game://session/${boundChannel}/advisor-chat (oyuncunun canlı AI Strateji & Fikir sohbeti)
   - game://session/${boundChannel}/war-theater (savaş olasılıkları, canlı kuşatmalar & cephe durumları)

2. ZORLUK MODUNA GÖRE DİPLOMASİ VE DİRENÇ:
   - Antlaşma, ittifak, toprak talebi ve ültimatomların kabul ihtimalini mutlaka aktif **Zorluk Modu** (${worldState.difficultyLabel}) kuralına göre belirle.
   - Oyuncunun emir kutusunda \`NOTE_TO_AI\` türünde bir direktif varsa bunu sahne arkası senaryo yönlendirmesi olarak dikkate al.

3. RAHATSIZLIK, PROTESTO VE ÇOK ULUSLU KONSEY TOPLAMA (KRİTİK):
   - Oyuncunun emir konsolunda yazdığı hamleler başka ülkelerin çıkarlarına dokunur veya uluslararası hukuku/hakları zorlarsa:
     * **Tek bir ülke** rahatsız olduysa: O ülkenin lideri ağzından \`reply_leader_chat\` (bire bir sohbete) veya \`send_diplomatic_message\` ile sert nota/itiraz mesajı gönder!
     * **Birden fazla ülke (2+)** aynı olaydan/haktan dolayı rahatsız olduysa veya koalisyon/hak savunusu gerekiyorsa: Mutlaka \`convene_diplomatic_council\` aracını çağırarak tüm ilgili ülkeleri tek bir **Konsey / Grup Zirvesi** odasında topla ve her liderin açılış konuşmasını yayınla!
   - \`pending-leader-chats\` içinde \`awaiting_leader_reply: true\` olan görüşmeleri \`reply_leader_chat\` ile, \`diplomatic-councils\` içinde \`awaiting_council_debate: true\` olan konseyleri ise \`reply_diplomatic_council\` aracıyla birden fazla liderin birbirine ve oyuncuya karşı argümanlarıyla yanıtla!

4. HARİTA ÜZERİNE KURULUM & ANİMASYONLU NOKTA İŞARETLEME (\`manage_map_markers\`):
   - Oyuncu veya başka bir ülke haritadaki spesifik bir şehre/bölgeye (örn. *"Ankara'da savunma sanayi fabrikası kur"*, *"İstanbul'a tersane inşa et"*, *"Sınıra hava savunma üssü kur"*, *"Berlin'de barış zirvesi topla"*) bir tesis kurduğunda, cephe hattı/kriz çıktığında veya mevcut bir tesis güçlendirilip yıkıldığında mutlaka \`manage_map_markers\` aracını çağır!
   - \`city_name\` (örn. "Ankara", "İstanbul", "Paris") veya \`region_id\`, \`category\` (\`INDUSTRY\`, \`MILITARY\`, \`INFRASTRUCTURE\`, \`NAVAL\`, \`RESEARCH\`, \`DIPLOMACY\`, \`INTERNAL\`, \`CRISIS\`), \`status\` (\`ACTIVE\`, \`UNDER_CONSTRUCTION\`, \`DAMAGED\`, \`ALERT\`) ve \`level\` (1-5) belirterek harita üzerinde tam o noktada animasyonlu parlayan işaretçi görünmesini sağla!
   - Sonraki turlarda o tesisi geliştirirken (\`action: "UPDATE"\`) veya savaşta yok edildiyse (\`action: "REMOVE"\`) yine \`manage_map_markers\` ile yönet.

5. GERÇEKÇİLİK, NÜKLEER ENVANTER VE ANTLAŞMA PAYLAŞIMI:
   - Bir ülke yalnızca envanterinde \`nuclear_warheads > 0\` ise \`launch_nuclear_strike\` kullanabilir! 1945 öncesi dönemlerde herkes 0 başlıkla başlar.
   - Oyuncu \`ALLIANCE\` / savunma paktı / nükleer şemsiye antlaşması imzaladığı nükleer güç sahibi bir ülkenin lideriyle (\`pending-leader-chats\`) görüşüp nükleer başlık/destek talep ederse: Zorluk Modu ve güven skoruna göre değerlendir; onaylarsan \`transfer_nuclear_warheads\` aracıyla veya \`reply_leader_chat\` içindeki \`transfer_nuclear_warheads\` parametresiyle 1-3 başlık devredebilirsin! Henüz ittifak/savunma antlaşması yoksa lider ağzından önce ittifak imzalanması gerektiğini belirt.
   - Oyuncu döneme tamamen aykırı veya fiziksel olarak imkansız bir emir verirse (örneğin 1936'da uzay lazeri veya 1444'te nükleer denizaltı üretmek), bu projeyi REDDET; hazine/istikrar kaybı uygula ve başarısızlığı \`publish_world_event\` ile dönem gazetesi dilinde duyur.

6. ZİNCİRLEME ETKİ VE ARAÇ KULLANIM ZORUNLULUĞU:
   - Her büyük hamlenin ekonomik, askeri, iç istikrar, \`infamy_delta\` ve diplomatik sonuçlarını hesapla; komşu ülkelerin ve büyük güçlerin kendi gündemlerini simüle et.
   - Turu değerlendirdikten sonra somut etkiler için \`transfer_territory\`, \`manage_map_markers\`, \`update_country_stats\`, \`manage_diplomacy\`, \`send_diplomatic_message\`, \`convene_diplomatic_council\` / \`reply_diplomatic_council\` ve \`publish_world_event\` araçlarını çağır.
   - GAZETE GRUPLAMA KURALI: Her turda onlarca dağınık küçük haber basmak yerine aynı temadaki/bölgedeki olayları 1-3 toplu, net kategorili manşette grupla; arayüz en güncelleri üstte tutup önceki turları otomatik \`ESKİ\` arşivi olarak gruplayacaktır.
   - Tüm güncellemeler bittiğinde EN SON \`advance_turn\` aracını çağırarak yeni tarihi (${worldState.scenario.suggestedNextDate}) ve tur özetini kaydet; aksi halde oyuncunun ekranı "AI Simülasyonu Bekleniyor" durumunda kalır!

7. AI DANIŞMAN & FİKİR SOHBETİ (\`reply_advisor_chat\`):
   - Oyuncu stratejik fikir veya tavsiye istediğinde (\`advisor-chat\` içinde \`awaiting_advisor_reply: true\` varsa) \`reply_advisor_chat\` ile analizini ve isterse \`suggested_orders\` öneri kartlarını gönder. DİKKAT: Danışman sohbeti sadece istişaredir; bu sohbete yanıt verirken \`advance_turn\` ÇAĞIRMA!

8. SÜRESİZ CANLI BEKLEME DÖNGÜSÜ (\`wait_for_player_action\` — ASLA KAPANMAZ & BOŞUNA TOKEN YAKMAZ):
   - \`advance_turn\`, \`reply_leader_chat\`, \`reply_diplomatic_council\` veya \`reply_advisor_chat\` işlemlerini tamamlar tamamlamaz (ya da ilk bağlandığında bekleyen bir emir yoksa) **DERHAL \`wait_for_player_action\` aracını parametre vermeden (varsayılan \`timeout_seconds=0\` = SÜRESİZ/SONSUZ)** çağır!
   - Bu araç oyuncu siteden yeni bir hamle/mesaj gönderene kadar **SÜRESİZ bekler**, kapanmaz ve bu sırada boşuna token tüketmez.
   - Oyuncu **"Turu Tamamla (AI Simülasyonunu Başlat)"**, **"Başkana Gönder"**, **"Konseye Gönder"** veya **"AI Danışman / Fikir Al"** butonuna bastığı an \`wait_for_player_action\` uyanıp tüm yeni verileri sana teslim eder; sen de gerekli araçları uygulayıp biter bitmez tekrar süresiz \`wait_for_player_action\` çağırarak döngüyü sürdür!`;
}

export interface McpRegistryMeta {
  resources: Record<string, { title: string; description: string }>;
  tools: Record<string, { title: string; description: string }>;
  prompt: { title: string; description: string };
}

export function getMcpRegistryMetadata(locale: AppLocale): McpRegistryMeta {
  if (locale === "en") {
    return {
      resources: {
        "world-state": {
          title: "World State & Global Tension",
          description:
            "Current game date, turn number, global tension, preferred response language (ENGLISH), active wars, and alliances.",
        },
        countries: {
          title: "Countries & National Statistics",
          description:
            "Current economy, military power, stability %, ideology, leader, infamy, war exhaustion, and treasury of all nations.",
        },
        "map-ownership": {
          title: "Province & Territory Ownership",
          description:
            "Ownership (country_id) and strategic status of all 270 world provinces (region_id).",
        },
        "pending-orders": {
          title: "Pending Player Orders & Dispatches",
          description:
            "Unprocessed free-text orders and diplomatic dispatches queued by the player.",
        },
        "chronicle-history": {
          title: "Chronicle & Historical Memory",
          description:
            "Past turn newspaper headlines, diplomatic dispatches, and historical turn summaries.",
        },
        "pending-leader-chats": {
          title: "Direct 1-on-1 Leader Diplomacy Chats",
          description:
            "Direct 1-on-1 diplomacy conversations with foreign leaders awaiting AI replies.",
        },
        "diplomatic-councils": {
          title: "Multi-Nation Diplomatic Councils & Coalitions",
          description:
            "Multi-nation summits, coalitions, and protest councils awaiting leader responses.",
        },
        "map-markers": {
          title: "Map Landmarks, Facilities & Animated Event Beacons",
          description:
            "City/province-level factories, military bases, shipyards, research centers, and crisis beacons rendered on the map.",
        },
        "advisor-chat": {
          title: "AI Advisor & Strategy Brainstorming Chat",
          description:
            "Live strategy brainstorm room where the player asks the AI Advisor for ideas and suggested orders.",
        },
        "war-theater": {
          title: "Live War Theater, Tension & Outbreak Probabilities",
          description:
            "Active wars, animated sieges, tank/infantry operations, bilateral tension scores, and war outbreak risk percentages.",
        },
      },
      tools: {
        list_game_sessions: {
          title: "List Active Mur4History Game Sessions",
          description:
            "Lists active Mur4History campaigns, selected nations, turn states, active browser tab, and MCP wait status.",
        },
        read_game_context: {
          title: "Read Full Game Context Snapshot",
          description:
            "Reads world state, countries, map landmarks, pending orders, leader/council chats, and advisor questions in a single call.",
        },
        transfer_territory: {
          title: "Transfer Territory",
          description:
            "Transfers map province ownership after war, annexation, purchase, or peace treaties and updates the live map.",
        },
        update_country_stats: {
          title: "Update Country Statistics",
          description:
            "Applies economy, military, domestic stability (0-100), infamy, war exhaustion, and ideology updates.",
        },
        manage_diplomacy: {
          title: "Manage Diplomacy",
          description:
            "Updates bilateral diplomatic status (WAR, ALLIANCE, NON_AGGRESSION, VASSAL, EMBARGO, NEUTRAL).",
        },
        publish_world_event: {
          title: "Publish World Newspaper Event",
          description:
            "Publishes era-appropriate world newspaper headlines to the Chronicle UI. Group related events into 1-3 crisp headlines per turn.",
        },
        send_diplomatic_message: {
          title: "Send Diplomatic Leader Message",
          description:
            "Sends an in-character diplomatic telegraph or letter from a foreign leader to the player.",
        },
        reply_leader_chat: {
          title: "Reply as Foreign Country Leader",
          description:
            "Replies 1-on-1 in character to the player's leader chat message and optionally updates diplomatic status/treaty.",
        },
        convene_diplomatic_council: {
          title: "Convene Multi-Nation Diplomatic Council / Coalition",
          description:
            "Creates a multi-nation Council, Coalition, Summit, or Protest room with opening statements whenever 2+ nations are concerned.",
        },
        reply_diplomatic_council: {
          title: "Post Multi-Leader Debate Responses in Council",
          description:
            "Adds multi-leader responses and counter-arguments inside an existing diplomatic council room.",
        },
        advance_turn: {
          title: "Advance Turn & Snapshot World",
          description:
            "Completes turn simulation, advances game date, clears pending orders, saves a rollback snapshot, and clears AI waiting state.",
        },
        wait_for_player_action: {
          title: "Wait Indefinitely for Player Button Click (Zero Idle Token Burn)",
          description:
            "Holds the MCP connection open INDEFINITELY at zero idle tokens until the player clicks Complete Turn, Leader Send, Council Send, or AI Advisor in the UI, returning full context immediately.",
        },
        manage_map_markers: {
          title: "Manage Map Facilities, Landmarks & Animated Beacons",
          description:
            "Creates, updates, or removes animated city/region facilities (factories, military bases, shipyards, R&D hubs, summits, crises) on the map.",
        },
        reply_advisor_chat: {
          title: "Reply to Player in AI Strategy Advisor & Brainstorm Chat",
          description:
            "Replies to player questions in the Strategy Advisor / War Room and optionally attaches one-click suggested_orders cards (do NOT call advance_turn).",
        },
        provoke_country: {
          title: "Provoke Nation / Incite Third-Party War",
          description:
            "Escalates bilateral tension & war probability via border skirmishes, insults, rebel sponsorship, or instigates open war between two other nations.",
        },
        trigger_war_operation: {
          title: "Launch or Advance Animated Siege / Military Operation",
          description:
            "Deploys animated marching infantry, armored tank blitz, air strikes, or naval invasions toward a target province on the live world map.",
        },
        launch_nuclear_strike: {
          title: "Launch Strategic Nuclear Strike",
          description:
            "Fires a ballistic nuclear warhead onto a target province/city (REQUIRES nuclear_warheads > 0 and consumes 1 warhead) with ICBM trajectory, mushroom cloud, and fallout marker.",
        },
        transfer_nuclear_warheads: {
          title: "Transfer / Share Nuclear Warheads Under Treaty",
          description:
            "Transfers 1-20 nuclear warheads from a nuclear patron country to an allied/treaty partner nation (e.g., NATO / defense umbrella), placing a deployment marker and headline.",
        },
      },
      prompt: {
        title: "Mur4History Game Master Directive (English)",
        description:
          "Loads full Alternate History & Grand Strategy Game Master rules and English output instructions into the connected AI.",
      },
    };
  }

  return {
    resources: {
      "world-state": {
        title: "World State & Global Tension",
        description:
          "Mevcut oyun tarihi, tur numarası, küresel tansiyon seviyesi, aktif dil tercihi (TÜRKÇE), aktif savaşlar ve ittifaklar.",
      },
      countries: {
        title: "Countries & National Statistics",
        description:
          "Tüm ülkelerin güncel ekonomi, askeri güç, istikrar %, ideoloji, lider ve hazine verileri.",
      },
      "map-ownership": {
        title: "Province & Territory Ownership",
        description:
          "Haritadaki her bölgenin (region_id) hangi ülkeye (country_id) ait olduğu ve stratejik durumu.",
      },
      "pending-orders": {
        title: "Pending Player Orders & Dispatches",
        description:
          "Oyuncunun komut merkezinden yazdığı ve henüz simüle edilmemiş son emirler ve diplomatik mesajlar.",
      },
      "chronicle-history": {
        title: "Chronicle & Historical Memory",
        description:
          "Önceki turlarda yaşanan gazete olayları, diplomatik yazışmalar ve tur özet geçmişi.",
      },
      "pending-leader-chats": {
        title: "Direct 1-on-1 Leader Diplomacy Chats",
        description:
          "Oyuncunun yabancı ülke başkanlarıyla başlattığı bire bir canlı sohbetler ve AI lider yanıtı bekleyen mesajlar.",
      },
      "diplomatic-councils": {
        title: "Multi-Nation Diplomatic Councils & Coalitions",
        description:
          "Birden fazla ülkenin aynı kriz, hak savunusu veya protesto için topladığı konsey ve grup görüşmeleri.",
      },
      "map-markers": {
        title: "Map Landmarks, Facilities & Animated Event Beacons",
        description:
          "Haritada şehir veya eyalet bazında kurulan fabrikalar, askeri üsler, tersaneler, araştırma merkezleri, demiryolları ve yerel kriz işaretleri.",
      },
      "advisor-chat": {
        title: "AI Advisor & Strategy Brainstorming Chat",
        description:
          "Oyuncunun doğrudan yapay zekaya stratejik fikir sorduğu veya mesajlaştığı canlı danışman sohbet odası.",
      },
      "war-theater": {
        title: "Canlı Savaş Meydanı, Gerilim & Savaş Çıkma Olasılıkları",
        description:
          "Aktif savaşlar, haritada ilerleyen animasyonlu kuşatma/tank/piyade harekatları, gerilim puanları ve savaş çıkma olasılığı yüzdeleri.",
      },
    },
    tools: {
      list_game_sessions: {
        title: "List Active Mur4History Game Sessions",
        description:
          "Sunucudaki aktif Mur4History oyun oturumlarını, seçili ülkeleri, tur durumunu ve MCP bekleme durumunu listeler.",
      },
      read_game_context: {
        title: "Read Full Game Context Snapshot",
        description:
          "Aktif oyun oturumunun dünya durumu, ülkeler, harita işaretleri, bekleyen emirler, lider/konsey sohbetleri ve danışman sorularını tek seferde okur.",
      },
      transfer_territory: {
        title: "Transfer Territory",
        description:
          "Savaş, ilhak, satın alma veya barış antlaşması sonucunda haritadaki bölgelerin sahipliğini değiştirir ve web haritasını canlı günceller.",
      },
      update_country_stats: {
        title: "Update Country Statistics",
        description:
          "Alınan kararların ülkelerin ekonomisine, ordusuna, iç istikrarına (0-100 ölçeği) ve ideolojisine etkisini işler.",
      },
      manage_diplomacy: {
        title: "Manage Diplomacy",
        description:
          "İki ülke arasındaki diplomatik statüyü günceller (Savaş, İttifak, Saldırmazlık Paktı, Vassal, Ambargo veya Tarafsız).",
      },
      publish_world_event: {
        title: "Publish World Newspaper Event",
        description:
          "Mur4History tarzında dönem atmosferine uygun gazete manşeti oluşturur; arayüzdeki Dünya Gazetesi'ne canlı basar.",
      },
      send_diplomatic_message: {
        title: "Send Diplomatic Leader Message",
        description:
          "Oyuncunun diplomatik hamlelerine diğer ülkelerin liderleri ağzından karakterine uygun yanıt gönderir.",
      },
      reply_leader_chat: {
        title: "Reply as Foreign Country Leader",
        description:
          "Oyuncunun lider sohbet penceresinden gönderdiği mesaja ilgili ülke başkanının ağzından bire bir yanıt gönderir ve gerekirse statü günceller.",
      },
      convene_diplomatic_council: {
        title: "Convene Multi-Nation Diplomatic Council / Coalition",
        description:
          "Birden fazla ülke aynı emirden veya olaydan rahatsız olduğunda otomatik çok uluslu Konsey / Grup Zirvesi kurar.",
      },
      reply_diplomatic_council: {
        title: "Post Multi-Leader Debate Responses in Council",
        description:
          "Mevcut bir çok uluslu konseyde oyuncunun mesajına veya tartışılan krize birden fazla ülke liderinin karşılıklı argümanlarını ekler.",
      },
      advance_turn: {
        title: "Advance Turn & Snapshot World",
        description:
          "Turu sonlandırır, oyun takvimini ilerletir, bekleyen emir kuyruğunu temizler ve geri alma snapshot'ı alır.",
      },
      wait_for_player_action: {
        title: "Wait Indefinitely for Player Button Click (Zero Idle Token Burn)",
        description:
          "MCP bağlantısını açık tutarak oyuncunun web arayüzünde 'Turu Tamamla', 'Başkana Gönder', 'Konseye Gönder' veya 'AI Danışman' butonuna basmasını SÜRESİZ bekler.",
      },
      manage_map_markers: {
        title: "Manage Map Facilities, Landmarks & Animated Beacons",
        description:
          "Haritada şehir veya eyalette kurulan fabrika, askeri üs, tersane, demiryolu, zirve veya kriz noktasını animasyonlu nokta olarak yönetir.",
      },
      reply_advisor_chat: {
        title: "Reply to Player in AI Strategy Advisor & Brainstorm Chat",
        description:
          "Oyuncunun Strateji Danışmanı / Fikir Odası'nda sorduğu sorulara yanıt ve tek tıkla emir öneri kartları (suggested_orders) sunar (turu ilerletmez).",
      },
      provoke_country: {
        title: "Ülke Kışkırt / Üçüncü Ülkeleri Birbirine Düşür",
        description:
          "Sınır tacizi, diplomatik hakaret, isyancı desteği veya sahte bayrak operasyonuyla savaş olasılığını yükseltir ve ülkeler arasında gerçek savaş çıkarır.",
      },
      trigger_war_operation: {
        title: "Canlı Animasyonlu Kuşatma / Taarruz Başlat",
        description:
          "Haritada bir hedef eyalete doğru yürüyen askerler, zırhlı tank birlikleri, hava akını veya deniz çıkarması harekatı başlatır/ilerletir.",
      },
      launch_nuclear_strike: {
        title: "Stratejik Nükleer Saldırı Düzenle",
        description:
          "Envanterde en az 1 nükleer başlık varsa seçili hedef eyalete balistik füze rotası, mantar bulutu ve krater işareti ile saldırı düzenler (1 başlık tüketir).",
      },
      transfer_nuclear_warheads: {
        title: "Antlaşma Kapsamında Nükleer Başlık Devret / Paylaş",
        description:
          "Nükleer güç sahibi bir ülkeden müttefik/antlaşmalı ülkeye (ör. NATO / savunma paktı altında) 1-20 nükleer başlık transfer eder, haritaya konuşlandırma işareti ve gazete haberi ekler.",
      },
    },
    prompt: {
      title: "Mur4History Game Master Directive (Türkçe)",
      description:
        "Bağlanan yapay zekaya alternatif tarih ve büyük strateji Game Master rolünü ve Türkçe yanıt kurallarını yükler.",
    },
  };
}
