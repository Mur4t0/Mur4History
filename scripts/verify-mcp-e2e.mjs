import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function run() {
  console.log("=== 1. Testing Scenarios & Session Creation ===");
  const initLocaleRes = await fetch(`${BASE}/api/locale`).catch(() => null);
  const initialLocale = initLocaleRes?.ok
    ? ((await initLocaleRes.json()).locale ?? "tr")
    : "tr";

  const scenRes = await fetch(`${BASE}/api/scenarios`);
  assert.equal(scenRes.status, 200);
  const scenJson = await scenRes.json();
  assert.ok(scenJson.scenarios.length >= 4, "Should have 4 preset scenarios");
  console.log("Scenarios loaded:", scenJson.scenarios.map((s) => s.id).join(", "));

  const createRes = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId: "1936",
      name: "E2E Verify Session",
      difficulty: "HARD",
      timeJumpInterval: "1M",
    }),
  });
  assert.equal(createRes.status, 201);
  const { session } = await createRes.json();
  assert.equal(session.difficulty, "HARD");
  assert.equal(session.timeJumpInterval, "1M");
  const sessionId = session.id;
  console.log("Created test session (HARD / 1M):", sessionId);

  try {
    console.log("=== 2. Testing Country Selection & Player Order ===");
    const patchRes = await fetch(`${BASE}/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerCountryCode: "TUR" }),
    });
    assert.equal(patchRes.status, 200);

    const orderRes = await fetch(`${BASE}/api/sessions/${sessionId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_turn",
        orderType: "COMMAND",
        content: "Montrö diplomasisini başlat ve Suriye sınırında tatbikat yap.",
        locale: "tr",
      }),
    });
    assert.equal(orderRes.status, 200);
    const orderData = await orderRes.json();
    assert.equal(orderData.awaitingAiSimulation, true);

    console.log("=== 3. Opening Real-Time UI SSE Stream ===");
    const sseAbort = new AbortController();
    const uiEvents = [];
    const uiStreamRes = await fetch(`${BASE}/api/sessions/${sessionId}/events`, {
      signal: sseAbort.signal,
    });
    assert.equal(uiStreamRes.status, 200);

    const reader = uiStreamRes.body.getReader();
    const decoder = new TextDecoder();
    const pumpPromise = (async () => {
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const blocks = buf.split("\n\n");
          buf = blocks.pop() ?? "";
          for (const block of blocks) {
            const evMatch = block.match(/^event:\s*(.+)$/m);
            if (evMatch) uiEvents.push(evMatch[1].trim());
          }
        }
      } catch {
        // Expected on abort
      }
    })();

    console.log("=== 4. Connecting Official MCP Client (Streamable HTTP) ===");
    const streamableTransport = new StreamableHTTPClientTransport(
      new URL(`${BASE}/api/mcp/${sessionId}`)
    );
    const mcpClient = new Client(
      { name: "mur4history-e2e-verifier", version: "1.0.0" },
      { capabilities: {} }
    );
    await mcpClient.connect(streamableTransport);

    // List & Read all 10 resources
    const resList = await mcpClient.listResources();
    console.log("MCP Resources:", resList.resources.map((r) => r.uri));
    assert.equal(resList.resources.length, 10);

    let worldStateJson = null;
    for (const r of resList.resources) {
      const readRes = await mcpClient.readResource({ uri: r.uri });
      assert.ok(readRes.contents.length > 0, `Empty resource: ${r.uri}`);
      if (r.uri.endsWith("/world-state")) {
        worldStateJson = JSON.parse(readRes.contents[0].text);
      }
    }
    assert.equal(worldStateJson.difficulty, "HARD");
    assert.equal(worldStateJson.timeJumpInterval, "1M");

    // List & Get Game Master Prompt
    const promptList = await mcpClient.listPrompts();
    assert.ok(
      promptList.prompts.some((p) => p.name === "pax_game_master_prompt")
    );
    const gmPrompt = await mcpClient.getPrompt({
      name: "pax_game_master_prompt",
      arguments: { player_focus: "Boğazlar ve Balkanlar" },
    });
    assert.ok(gmPrompt.messages[0].content.text.includes("ZORUNLU OYUN"));

    // Send a 1-on-1 player chat message to France's leader
    const chatPost = await fetch(`${BASE}/api/sessions/${sessionId}/leader-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetCountryCode: "FRA",
        content: "Sayın Başkan, Akdeniz ve Hatay konusunda görüşmeye hazır mısınız?",
      }),
    });
    assert.equal(chatPost.status, 201);

    // Also test a NOTE_TO_AI order
    const noteRes = await fetch(`${BASE}/api/sessions/${sessionId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "queue",
        orderType: "NOTE_TO_AI",
        content: "AI'ya Not: Boğazlar krizi barışçıl konferansla ilerlesin.",
      }),
    });
    assert.equal(noteRes.status, 200);

    // Call all 18 MCP Tools (including War Theater & Nuclear Sharing tools!)
    const toolsList = await mcpClient.listTools();
    console.log("MCP Tools:", toolsList.tools.map((t) => t.name));
    assert.equal(toolsList.tools.length, 18);

    // Since orderRes (complete_turn) and chatPost are already pending, calling wait_for_player_action resolves immediately:
    const immediateWait = await mcpClient.callTool({
      name: "wait_for_player_action",
      arguments: { timeout_seconds: 10 },
    });
    const immediateWaitJson = JSON.parse(immediateWait.content[0].text);
    assert.equal(immediateWaitJson.triggered, true);
    assert.equal(immediateWaitJson.status, "IMMEDIATE_ACTION_READY");
    console.log("Immediate wait_for_player_action verified:", immediateWaitJson.status);

    await mcpClient.callTool({
      name: "reply_leader_chat",
      arguments: {
        target_country_id: "FRA",
        reply_message: "Ankara ile yapıcı müzakerelere açığız.",
      },
    });

    await mcpClient.callTool({
      name: "convene_diplomatic_council",
      arguments: {
        title: "Doğu Akdeniz Güvenlik Konseyi",
        topic: "Sınır tatbikatı sonrası bölgesel denge ve egemenlik hakları",
        council_type: "COUNCIL",
        initiator_country_id: "FRA",
        participant_country_ids: ["FRA", "GBR", "TUR"],
        opening_statements: [
          {
            country_id: "FRA",
            message: "Bölgedeki askeri hareketliliği Londra ile birlikte kaygıyla izliyoruz.",
            stance: "CRITICAL",
          },
          {
            country_id: "GBR",
            message: "Boğazlar ve Doğu Akdeniz statüsü çok taraflı masada ele alınmalı.",
            stance: "MEDIATOR",
          },
        ],
      },
    });

    const councilsResource = await mcpClient.readResource({
      uri: `game://session/${sessionId}/diplomatic-councils`,
    });
    const parsedCouncils = JSON.parse(councilsResource.contents[0].text);
    assert.ok(parsedCouncils.councils.length >= 1, "Expected created council");
    const createdCouncilId = parsedCouncils.councils[0].council_id;

    // Player speaks in the council room
    const councilReplyRes = await fetch(`${BASE}/api/sessions/${sessionId}/councils`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "message",
        councilId: createdCouncilId,
        content: "Uluslararası hukuka ve karşılıklı güvenliğe bağlıyız.",
      }),
    });
    assert.equal(councilReplyRes.status, 201);

    await mcpClient.callTool({
      name: "reply_diplomatic_council",
      arguments: {
        council_id: createdCouncilId,
        responses: [
          {
            country_id: "GBR",
            message: "Ankara'nın bu açıklaması yapıcı bir zemin oluşturuyor.",
            stance: "SUPPORTIVE",
          },
        ],
        council_status: "OPEN",
      },
    });

    await mcpClient.callTool({
      name: "transfer_territory",
      arguments: {
        region_ids: ["SYR"],
        new_owner_country_id: "TUR",
        reason: "Ankara-Paris Anlaşması ile devir",
      },
    });
    await mcpClient.callTool({
      name: "update_country_stats",
      arguments: {
        country_id: "TUR",
        economy_delta: 6,
        military_delta: 4,
        stability_delta: 3,
        infamy_delta: 10,
      },
    });
    await mcpClient.callTool({
      name: "manage_diplomacy",
      arguments: {
        country_a: "TUR",
        country_b: "FRA",
        relation_status: "NON_AGGRESSION",
        treaty_name: "Akdeniz Uzlaşısı",
      },
    });
    await mcpClient.callTool({
      name: "publish_world_event",
      arguments: {
        headline: "BOĞAZLARDA TÜRK EGEMENLİĞİ VE SURİYE MUTABAKATI",
        article_body:
          "Ankara ile Paris arasında imzalanan mutabakat bölgede yeni bir denge kurdu.",
        category: "DIPLOMACY",
        involved_countries: ["TUR", "FRA"],
      },
    });
    await mcpClient.callTool({
      name: "send_diplomatic_message",
      arguments: {
        from_country_id: "FRA",
        to_country_id: "TUR",
        sender_title: "Fransa Dışişleri Bakanı",
        message: "Doğu Akdeniz'de istikrar için işbirliğine hazırız.",
      },
    });

    const markerCreateRes = await mcpClient.callTool({
      name: "manage_map_markers",
      arguments: {
        action: "CREATE",
        country_id: "TUR",
        city_name: "Ankara",
        title: "Ankara Savunma ve Makina Fabrikası",
        description: "Başkentte topçu, mühimmat ve zırhlı araç üretim kompleksi kuruldu.",
        category: "INDUSTRY",
        status: "ACTIVE",
        level: 2,
        is_animated: true,
      },
    });
    const markerCreateJson = JSON.parse(markerCreateRes.content[0].text);
    assert.equal(markerCreateJson.ok, true);
    assert.equal(markerCreateJson.action, "CREATED");
    assert.ok(
      Math.abs(markerCreateJson.marker.lat - 39.9334) < 0.1 &&
        Math.abs(markerCreateJson.marker.lng - 32.8597) < 0.1,
      "Expected Ankara coordinates resolved automatically"
    );

    const markersResource = await mcpClient.readResource({
      uri: `game://session/${sessionId}/map-markers`,
    });
    const parsedMarkers = JSON.parse(markersResource.contents[0].text);
    assert.ok(parsedMarkers.totalMarkers >= 1, "Expected Ankara marker in resource");

    await mcpClient.callTool({
      name: "manage_map_markers",
      arguments: {
        action: "UPDATE",
        marker_id: markerCreateJson.marker.id,
        level: 3,
        status: "COMPLETED",
      },
    });
    await mcpClient.callTool({
      name: "advance_turn",
      arguments: {
        new_date: "1936-02-01",
        turn_summary: "Türkiye diplomatik hamlelerle sınırını genişletti.",
      },
    });

    // Also resolve the GBR reply so no pending items remain, then test live blocking wait_for_player_action wake-up!
    const blockingWaitPromise = mcpClient.callTool({
      name: "wait_for_player_action",
      arguments: { timeout_seconds: 15 },
    });

    await new Promise((r) => setTimeout(r, 250));
    // Simulate player clicking "Gönder" in Leader Chat while AI is actively waiting
    const wakeChatRes = await fetch(
      `${BASE}/api/sessions/${sessionId}/leader-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCountryCode: "GBR",
          content: "Londra ile yeni deniz ticareti anlaşması imzalamak istiyoruz.",
        }),
      }
    );
    assert.equal(wakeChatRes.status, 201);

    const blockingWaitRes = await blockingWaitPromise;
    const blockingWaitJson = JSON.parse(blockingWaitRes.content[0].text);
    assert.equal(blockingWaitJson.triggered, true);
    assert.equal(blockingWaitJson.status, "PLAYER_ACTION_RECEIVED");
    assert.equal(blockingWaitJson.trigger.triggerType, "LEADER_CHAT");
    console.log(
      "Live blocking wait_for_player_action wake-up verified:",
      blockingWaitJson.status
    );

    // Clear the GBR pending leader chat before starting the Advisor wait test
    await mcpClient.callTool({
      name: "reply_leader_chat",
      arguments: {
        target_country_id: "GBR",
        reply_message: "Deniz ticareti heyeti göndermeye hazırız.",
      },
    });

    // Test INDEFINITE wait_for_player_action (timeout_seconds: 0 / omitted = never closes until player acts!)
    const advisorWaitPromise = mcpClient.callTool({
      name: "wait_for_player_action",
      arguments: { timeout_seconds: 0 },
    });

    await new Promise((r) => setTimeout(r, 400));
    const advisorPostRes = await fetch(
      `${BASE}/api/sessions/${sessionId}/advisor-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Ankara ve İzmir için en iyi ekonomik/askeri hamle fikrin nedir?",
        }),
      }
    );
    assert.equal(advisorPostRes.status, 201);

    const advisorWaitRes = await advisorWaitPromise;
    const advisorWaitJson = JSON.parse(advisorWaitRes.content[0].text);
    assert.equal(advisorWaitJson.triggered, true);
    assert.equal(advisorWaitJson.trigger.triggerType, "ADVISOR_CHAT");
    assert.ok(advisorWaitJson.pendingAdvisorMessages.length >= 1);

    const advisorReplyRes = await mcpClient.callTool({
      name: "reply_advisor_chat",
      arguments: {
        reply_message:
          "Ankara'da savunma sanayi fabrikası kurup İzmir'de ihracat limanını güçlendirmeniz en hızlı büyümeyi sağlar.",
        suggested_orders: [
          {
            title: "Ankara Savunma Fabrikası",
            category: "ECONOMY",
            command: "Ankara'da savunma ve ağır makina fabrikası inşa et.",
          },
        ],
      },
    });
    const advisorReplyJson = JSON.parse(advisorReplyRes.content[0].text);
    assert.equal(advisorReplyJson.ok, true);
    assert.equal(advisorReplyJson.message.suggestedOrders.length, 1);
    console.log("AI Advisor MCP chat & suggested_orders verified!");

    // Test Live War Engine, War Probability, Provocations & Nuclear Strike
    const warGetRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`);
    assert.equal(warGetRes.status, 200);
    const warGetData = await warGetRes.json();
    assert.ok(Object.keys(warGetData.playerRisks || {}).length > 100);

    const inciteRes = await mcpClient.callTool({
      name: "provoke_country",
      arguments: {
        actor_country_id: "TUR",
        target_country_id: "FRA",
        instigate_with_country_id: "ITA",
        action_type: "INCITE_THIRD_PARTY_WAR",
      },
    });
    const inciteJson = JSON.parse(inciteRes.content[0].text);
    assert.equal(inciteJson.ok, true);
    assert.ok(inciteJson.newTension >= 50);

    const opRes = await mcpClient.callTool({
      name: "trigger_war_operation",
      arguments: {
        mode: "LAUNCH",
        attacker_country_id: "TUR",
        defender_country_id: "ITA",
        operation_type: "TANK_BLITZ",
        unit_type: "ARMOR",
        intensity: 82,
      },
    });
    const opJson = JSON.parse(opRes.content[0].text);
    assert.equal(opJson.ok, true);
    assert.equal(opJson.operation.unitType, "ARMOR");

    const advWarRes = await mcpClient.callTool({
      name: "trigger_war_operation",
      arguments: { mode: "ADVANCE" },
    });
    const advWarJson = JSON.parse(advWarRes.content[0].text);
    assert.equal(advWarJson.ok, true);
    assert.ok(advWarJson.advancedCount >= 1);

    // Verify ITA automatically launched a live Counter-Offensive (ITA -> TUR) when attacked!
    const counterCheckRes = await fetch(`${BASE}/api/sessions/${sessionId}`);
    const counterCheckJson = await counterCheckRes.json();
    const itaCounterOp = (counterCheckJson.session.warOperations ?? []).find(
      (w) => w.attackerCode === "ITA" && w.defenderCode === "TUR"
    );
    assert.ok(
      itaCounterOp,
      "Expected defending nation ITA to automatically launch a live Counter-Offensive against attacker TUR!"
    );

    // Verify SPONSOR_REBELS dispatches Covert Envoys (ENVOY_AGITATION) -> stability drops -> Internal Uprising (REBEL_UPRISING) WITHOUT annexing BGR!
    let preBgrRes = await fetch(`${BASE}/api/sessions/${sessionId}`);
    let preBgrJson = await preBgrRes.json();
    let bgrState = preBgrJson.session.countries.find((c) => c.code === "BGR");
    const bgrInitStab = bgrState.stability;

    const envoyRes1 = await mcpClient.callTool({
      name: "provoke_country",
      arguments: {
        actor_country_id: "TUR",
        target_country_id: "BGR",
        action_type: "SPONSOR_REBELS",
        target_region_id: "BGR",
      },
    });
    const envoyJson1 = JSON.parse(envoyRes1.content[0].text);
    assert.equal(envoyJson1.ok, true);
    if (bgrInitStab - 10 > 45) {
      assert.equal(envoyJson1.operation.operationType, "ENVOY_AGITATION");
      assert.equal(envoyJson1.operation.unitType, "ENVOY");
    }

    // Advance covert envoy mission until completed ("AGITATED"), proving BGR still owns BGR!
    for (let step = 0; step < 6; step++) {
      await mcpClient.callTool({
        name: "trigger_war_operation",
        arguments: { mode: "ADVANCE" },
      });
    }
    preBgrRes = await fetch(`${BASE}/api/sessions/${sessionId}`);
    preBgrJson = await preBgrRes.json();
    let bgrRegion = preBgrJson.session.regions.find((r) => r.regionId === "BGR");
    assert.equal(
      bgrRegion.ownerCountryCode,
      "BGR",
      `Covert envoy agitation must NOT annex BGR! Owner became: ${bgrRegion.ownerCountryCode}`
    );
    bgrState = preBgrJson.session.countries.find((c) => c.code === "BGR");
    assert.ok(
      bgrState.stability < bgrInitStab - 15,
      `Expected BGR stability drop after envoy wave (was ${bgrInitStab}, now ${bgrState.stability})`
    );
    assert.ok(
      (preBgrJson.session.mapMarkers ?? []).some(
        (m) => m.regionId === "BGR" && m.category === "CRISIS"
      ),
      "Expected pulsing CRISIS unrest marker on BGR after covert envoy wave"
    );

    // Push once more so stability hits <= 45 and sparks REBEL_UPRISING, STILL without annexing BGR!
    const envoyRes2 = await mcpClient.callTool({
      name: "provoke_country",
      arguments: {
        actor_country_id: "TUR",
        target_country_id: "BGR",
        action_type: "SPONSOR_REBELS",
        target_region_id: "BGR",
      },
    });
    const envoyJson2 = JSON.parse(envoyRes2.content[0].text);
    assert.equal(envoyJson2.ok, true);
    assert.equal(envoyJson2.operation.operationType, "REBEL_UPRISING");

    for (let step = 0; step < 6; step++) {
      await mcpClient.callTool({
        name: "trigger_war_operation",
        arguments: { mode: "ADVANCE" },
      });
    }
    preBgrRes = await fetch(`${BASE}/api/sessions/${sessionId}`);
    preBgrJson = await preBgrRes.json();
    bgrRegion = preBgrJson.session.regions.find((r) => r.regionId === "BGR");
    assert.equal(
      bgrRegion.ownerCountryCode,
      "BGR",
      `Popular uprising must NOT transfer BGR to TUR! Owner became: ${bgrRegion.ownerCountryCode}`
    );
    assert.equal(
      bgrRegion.strategicStatus,
      "CONTESTED",
      `Expected CONTESTED status on BGR during popular uprising, got: ${bgrRegion.strategicStatus}`
    );
    const finishedRebelOp = (preBgrJson.session.warOperations ?? []).find(
      (w) => w.defenderCode === "BGR" && w.operationType === "REBEL_UPRISING"
    );
    assert.equal(finishedRebelOp?.status, "UPRISING");
    const turVsItaOp = (preBgrJson.session.warOperations ?? []).find(
      (w) => w.id === opJson.operation.id
    );
    assert.equal(
      turVsItaOp?.status,
      "REPELLED",
      `Expected reckless head-on siege by TUR (62 mil) against stronger fortified ITA (74 mil) on HARD to be REPELLED, got: ${turVsItaOp?.status}`
    );
    console.log("Live Defender Counter-Attack, Garrison Siege Repulsion (REPELLED) & Covert Envoy Uprising verified!");

    // Verify player cannot hijack foreign nation military via UI /war route (403)
    const hijackRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "launch_operation",
        attackerCode: "FRA",
        defenderCode: "GER",
        operationType: "TANK_BLITZ",
      }),
    });
    assert.equal(
      hijackRes.status,
      403,
      `Expected 403 when attempting to command foreign country FRA as TUR, got: ${hijackRes.status}`
    );

    // Verify player cannot unilaterally force instant ceasefire on third-party wars (ITA vs ETH in 1936)
    const illegalCeasefireRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ceasefire",
        countryA: "ITA",
        countryB: "ETH",
      }),
    });
    assert.equal(
      illegalCeasefireRes.status,
      400,
      `Expected 400 when attempting unilateral third-party ceasefire, got: ${illegalCeasefireRes.status}`
    );

    // Verify Multilateral Peace Council convening & resolution for ITA vs ETH
    const convenePeaceRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "convene_peace_council",
        countryA: "ITA",
        countryB: "ETH",
      }),
    });
    assert.equal(convenePeaceRes.status, 201);
    const convenePeaceJson = await convenePeaceRes.json();
    assert.ok(convenePeaceJson.council?.id);
    assert.ok(convenePeaceJson.council.participantCodes.includes("ITA"));
    assert.ok(convenePeaceJson.council.participantCodes.includes("ETH"));
    assert.ok(convenePeaceJson.council.participantCodes.includes("TUR"));

    const resolvePeaceRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "resolve_peace_council",
        councilId: convenePeaceJson.council.id,
        countryA: "ITA",
        countryB: "ETH",
        proposalType: "COERCIVE_COALITION",
      }),
    });
    assert.equal(resolvePeaceRes.status, 200);
    const resolvePeaceJson = await resolvePeaceRes.json();
    assert.ok(typeof resolvePeaceJson.accepted === "boolean");
    assert.ok(resolvePeaceJson.evaluation?.threshold >= 50);
    console.log("Anti-Hijack Lock, Third-Party Ceasefire Block & Multilateral Peace Council verified!");

    // Verify nuclear strike is blocked when nation has 0 warheads
    const blockedNukeRes = await fetch(`${BASE}/api/sessions/${sessionId}/war`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "nuclear_strike",
        attackerCode: "TUR",
        defenderCode: "ITA",
      }),
    });
    assert.equal(blockedNukeRes.status, 400);
    const blockedNukeJson = await blockedNukeRes.json();
    assert.ok(
      blockedNukeJson.error && blockedNukeJson.error.includes("0"),
      `Expected 0-warhead rejection error, got: ${blockedNukeJson.error}`
    );

    // Give FRA a test nuclear arsenal, verify transfer without ALLIANCE is rejected,
    // then upgrade FRA<->TUR to ALLIANCE + share warheads via reply_leader_chat!
    await mcpClient.callTool({
      name: "update_country_stats",
      arguments: {
        country_id: "FRA",
        economy_delta: 0,
        military_delta: 0,
        stability_delta: 0,
        nuclear_warheads_delta: 3,
      },
    });

    const noTreatyTransferRes = await fetch(
      `${BASE}/api/sessions/${sessionId}/nuclear`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "transfer",
          fromCode: "FRA",
          toCode: "TUR",
          count: 1,
          requireTreaty: true,
        }),
      }
    );
    assert.equal(noTreatyTransferRes.status, 400);

    // Negotiate with FRA leader to form ALLIANCE & grant 2 warheads under treaty
    const treatyReplyRes = await mcpClient.callTool({
      name: "reply_leader_chat",
      arguments: {
        target_country_id: "FRA",
        reply_message:
          "Ankara-Paris Nükleer Savunma Antlaşması imzalandı; 2 taktik başlık sevk edildi.",
        relation_status: "ALLIANCE",
        treaty_name: "Ankara-Paris Nükleer Savunma Antlaşması",
        transfer_nuclear_warheads: 2,
      },
    });
    const treatyReplyJson = JSON.parse(treatyReplyRes.content[0].text);
    assert.equal(treatyReplyJson.ok, true);
    assert.equal(treatyReplyJson.nuclearTransfer.recipientWarheads, 2);
    assert.equal(treatyReplyJson.nuclearTransfer.donorWarheads, 1);

    // Now launch_nuclear_strike succeeds and consumes 1 warhead (2 -> 1)!
    const nukeRes = await mcpClient.callTool({
      name: "launch_nuclear_strike",
      arguments: {
        attacker_country_id: "TUR",
        defender_country_id: "ITA",
      },
    });
    const nukeJson = JSON.parse(nukeRes.content[0].text);
    assert.equal(nukeJson.ok, true);
    assert.equal(nukeJson.operation.operationType, "NUCLEAR_STRIKE");
    assert.equal(nukeJson.operation.status, "DETONATED");

    const postNukeState = await (await fetch(`${BASE}/api/sessions/${sessionId}`)).json();
    const postNukeTur = postNukeState.session.countries.find((c) => c.code === "TUR");
    assert.equal(postNukeTur.nuclearWarheads, 1);
    console.log("Nuclear Stockpile Gating, Treaty Sharing & Detonation verified!");

    await mcpClient.close();

    // Give UI SSE stream a moment to flush
    await new Promise((r) => setTimeout(r, 400));
    sseAbort.abort();
    await pumpPromise;

    console.log("UI SSE events received:", uiEvents);
    for (const expected of [
      "mcp_status",
      "territory_transferred",
      "stats_updated",
      "diplomacy_updated",
      "event_published",
      "message_sent",
      "leader_chat_updated",
      "leader_chat_reply",
      "council_updated",
      "map_marker_updated",
      "war_operation_started",
      "war_operation_updated",
      "nuclear_strike",
      "nuclear_transferred",
      "diplomatic_provocation",
      "advisor_chat_updated",
      "advisor_chat_reply",
      "turn_advanced",
      "player_action_triggered",
    ]) {
      assert.ok(
        uiEvents.includes(expected),
        `Missing real-time SSE event: ${expected}`
      );
    }

    console.log("=== 5. Testing Legacy SSE MCP Transport (/sse) ===");
    const legacyTransport = new SSEClientTransport(
      new URL(`${BASE}/api/mcp/${sessionId}/sse`)
    );
    const legacyClient = new Client(
      { name: "mur4history-legacy-sse-verifier", version: "1.0.0" },
      { capabilities: {} }
    );
    await legacyClient.connect(legacyTransport);
    const legacyTools = await legacyClient.listTools();
    assert.equal(legacyTools.tools.length, 18);
    await legacyClient.close();
    console.log("Legacy SSE transport verified successfully!");

    console.log("=== 6. Testing Full Save Export & Import Round-Trip ===");
    const exportRes = await fetch(
      `${BASE}/api/sessions/${sessionId}/export?download=1`
    );
    assert.equal(exportRes.status, 200);
    const dispHeader = exportRes.headers.get("content-disposition") || "";
    assert.ok(
      dispHeader.includes(".mur4history.json"),
      `Expected attachment filename .mur4history.json, got: ${dispHeader}`
    );
    const exportedArchive = await exportRes.json();
    assert.equal(exportedArchive.format, "mur4history-save");
    assert.equal(exportedArchive.session.turnNumber, 2);
    assert.ok(exportedArchive.countries.length > 100);
    assert.ok(exportedArchive.regions.length > 200);
    assert.ok(exportedArchive.councils.length >= 1);
    assert.ok(exportedArchive.mapMarkers.some((m) => m.cityName === "Ankara" && m.level === 3));
    assert.ok(Array.isArray(exportedArchive.warOperations) && exportedArchive.warOperations.length >= 2);
    assert.ok(exportedArchive.advisorChats.length >= 2);
    assert.ok(exportedArchive.leaderChats.length >= 2);
    assert.ok(exportedArchive.snapshots.length >= 2);

    const importRes = await fetch(`${BASE}/api/sessions/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archive: exportedArchive,
        customName: "Imported Save Check",
      }),
    });
    assert.equal(importRes.status, 201);
    const importJson = await importRes.json();
    const importedId = importJson.session.id;
    assert.notEqual(importedId, sessionId);
    assert.equal(importJson.session.name, "Imported Save Check");
    assert.equal(importJson.session.turnNumber, 2);
    assert.equal(importJson.session.playerCountryCode, "TUR");
    assert.equal(
      importJson.session.regions.find((r) => r.regionId === "SYR")?.ownerCountryCode,
      "TUR"
    );
    assert.ok(
      importJson.session.mapMarkers.some(
        (m) => m.cityName === "Ankara" && m.level === 3
      )
    );
    assert.ok(importJson.session.councils.length >= 1);
    assert.ok(importJson.session.advisorChats.length >= 2);
    assert.ok(importJson.session.snapshots.length >= 2);
    await fetch(`${BASE}/api/sessions/${importedId}`, { method: "DELETE" });
    console.log("Full Save Export & Import round-trip verified:", importedId);

    const cloneRes1 = await fetch(`${BASE}/api/sessions/${sessionId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "tr" }),
    });
    assert.equal(cloneRes1.status, 201);
    const cloneJson1 = await cloneRes1.json();
    const clonedId1 = cloneJson1.session.id;
    assert.notEqual(clonedId1, sessionId);
    assert.ok(cloneJson1.session.name.endsWith("(Klon)"));
    assert.equal(cloneJson1.session.turnNumber, 2);
    assert.equal(cloneJson1.session.playerCountryCode, "TUR");
    assert.equal(
      cloneJson1.session.regions.length,
      exportedArchive.regions.length
    );
    assert.ok(
      (cloneJson1.session.warOperations ?? []).length >= 2,
      "Expected warOperations cloned into duplicate session"
    );
    assert.ok(
      cloneJson1.session.mapMarkers.some(
        (m) => m.cityName === "Ankara" && m.level === 3
      )
    );

    const cloneRes2 = await fetch(`${BASE}/api/sessions/${clonedId1}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "tr" }),
    });
    assert.equal(cloneRes2.status, 201);
    const cloneJson2 = await cloneRes2.json();
    const clonedId2 = cloneJson2.session.id;
    assert.notEqual(clonedId2, clonedId1);
    assert.ok(cloneJson2.session.name.endsWith("(Klon 2)"));

    await fetch(`${BASE}/api/sessions/${clonedId2}`, { method: "DELETE" });
    await fetch(`${BASE}/api/sessions/${clonedId1}`, { method: "DELETE" });
    console.log("1-Click Save Clone & incremented name verified:", clonedId1, clonedId2);

    console.log("=== 7. Testing Turn Rollback (Time Travel to Turn 1) ===");
    const afterTurnRes = await fetch(`${BASE}/api/sessions/${sessionId}`);
    const afterTurnJson = await afterTurnRes.json();
    assert.equal(afterTurnJson.session.turnNumber, 2);
    assert.equal(afterTurnJson.session.awaitingAiSimulation, false);
    assert.ok(
      (afterTurnJson.session.councils ?? []).length >= 1,
      "Expected council in session state"
    );
    assert.ok(
      (afterTurnJson.session.mapMarkers ?? []).some(
        (m) => m.cityName === "Ankara" && m.level === 3
      ),
      "Expected Ankara upgraded marker in session state"
    );
    const turCountry = afterTurnJson.session.countries.find(
      (c) => c.code === "TUR"
    );
    assert.ok(turCountry.infamy >= 5, "Expected TUR infamy delta >= 5");
    const syrRegion = afterTurnJson.session.regions.find(
      (r) => r.regionId === "SYR"
    );
    assert.equal(syrRegion.ownerCountryCode, "TUR");

    const rollbackRes = await fetch(
      `${BASE}/api/sessions/${sessionId}/rollback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTurnNumber: 1 }),
      }
    );
    assert.equal(rollbackRes.status, 200);
    const rollbackJson = await rollbackRes.json();
    assert.equal(rollbackJson.session.turnNumber, 1);
    assert.equal((rollbackJson.session.mapMarkers ?? []).length, 0);
    const syrRolledBack = rollbackJson.session.regions.find(
      (r) => r.regionId === "SYR"
    );
    assert.equal(syrRolledBack.ownerCountryCode, "FRA");
    console.log("Turn rollback restored SYR back to FRA and Turn 1!");

    console.log("=== 8. Testing Dynamic English MCP Output Switch ===");
    const setEnRes = await fetch(`${BASE}/api/locale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en", sessionId }),
    });
    assert.equal(setEnRes.status, 200);

    const enTransport = new StreamableHTTPClientTransport(
      new URL(`${BASE}/api/mcp/${sessionId}`)
    );
    const enClient = new Client(
      { name: "mur4history-en-locale-verifier", version: "1.0.0" },
      { capabilities: {} }
    );
    await enClient.connect(enTransport);

    const enPrompt = await enClient.getPrompt({
      name: "pax_game_master_prompt",
      arguments: { player_focus: "Straits & Mediterranean" },
    });
    const enPromptText = enPrompt.messages[0].content.text;
    assert.ok(enPromptText.includes("MANDATORY GAME MASTER RULES"));
    assert.ok(enPromptText.includes("ENGLISH"));
    assert.ok(!enPromptText.includes("ZORUNLU OYUN"));

    const enTools = await enClient.listTools();
    const enWaitTool = enTools.tools.find(
      (t) => t.name === "wait_for_player_action"
    );
    assert.ok(
      enWaitTool?.description?.includes("INDEFINITELY"),
      `Expected English tool description, got: ${enWaitTool?.description}`
    );

    const enWorldRes = await enClient.readResource({
      uri: `game://session/${sessionId}/world-state`,
    });
    const enWorld = JSON.parse(enWorldRes.contents[0].text);
    assert.equal(enWorld.preferredLanguage, "en");
    assert.equal(enWorld.difficultyLabel, "Hard");
    assert.equal(enWorld.scenario.title, "1936: Gathering Storm");
    assert.equal(enWorld.playerCountryName, "Republic of Turkey");
    assert.ok(enWorld.difficultyRules.includes("DIFFICULTY = HARD"));

    const enOrderRes = await fetch(`${BASE}/api/sessions/${sessionId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_turn",
        locale: "en",
      }),
    });
    assert.equal(enOrderRes.status, 200);

    const enWaitCall = await enClient.callTool({
      name: "wait_for_player_action",
      arguments: { timeout_seconds: 5 },
    });
    const enWaitJson = JSON.parse(enWaitCall.content[0].text);
    assert.equal(enWaitJson.preferredLanguage, "en");
    assert.ok(enWaitJson.instruction.includes("PLAYER ACTION READY!"));
    assert.ok(enWaitJson.instruction.includes("ENGLISH"));

    const enAdvanceCall = await enClient.callTool({
      name: "advance_turn",
      arguments: {
        new_date: "1936-02-01",
        turn_summary: "English diplomatic summit concluded.",
      },
    });
    const enAdvJson = JSON.parse(enAdvanceCall.content[0].text);
    assert.ok(enAdvJson.instruction.includes("Turn advanced."));
    assert.ok(enAdvJson.instruction.includes("ENGLISH"));

    await enClient.close();
    console.log("Dynamic English MCP prompt, resources, tools & wakeups verified!");

    console.log("ALL E2E CHECKS PASSED!");
  } finally {
    await fetch(`${BASE}/api/locale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: initialLocale }),
    }).catch(() => undefined);
    await fetch(`${BASE}/api/sessions/${sessionId}`, { method: "DELETE" });
    console.log("Cleaned up test session:", sessionId);
  }
}

run().catch((err) => {
  console.error("E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
