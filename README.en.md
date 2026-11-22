<div align="center">
  <img src="public/images/brand/mur4history-logo.png" alt="Mur4History Logo" width="380" />

  <h3>Alternate History &amp; Grand Strategy MCP Simulation Platform</h3>
  <p><em>Alternatif Tarih &amp; Büyük Strateji MCP Simülasyon Platformu</em></p>

  <p>
    <a href="README.md"><strong>🇹🇷 Türkçe Oku (README.md)</strong></a> • <strong>🇬🇧 English (Active)</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Made%20in%20T%C3%BCrkiye-T%C3%BCrk%20Yap%C4%B1m%C4%B1-E30A17?style=for-the-badge" alt="Made in Türkiye" />
    <img src="https://img.shields.io/badge/Built%20with-Vibe%20Coding%20%E2%9A%A1-8B5CF6?style=for-the-badge" alt="Built with Vibe Coding" />
    <img src="https://img.shields.io/badge/Protocol-Native%20MCP-10B981?style=for-the-badge" alt="Native MCP" />
    <img src="https://img.shields.io/badge/Languages-TR%20%7C%20EN-F59E0B?style=for-the-badge" alt="Turkish and English" />
    <img src="https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge" alt="MIT License" />
  </p>

  <p>
    <a href="https://discord.gg/pZSkGpW2yK">
      <img src="https://img.shields.io/badge/Discord-Join%20Mur4Code-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Mur4Code" />
    </a>
    <a href="https://github.com/Mur4t0">
      <img src="https://img.shields.io/badge/GitHub-@Mur4t0-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub @Mur4t0" />
    </a>
  </p>
</div>

---

## Community & Creator

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://discord.gg/pZSkGpW2yK">
        <img src="public/images/community/mur4code-icon.png" width="76" alt="Mur4Code Discord" style="border-radius:16px;" />
      </a>
      <br />
      <strong><a href="https://discord.gg/pZSkGpW2yK">💬 Mur4Code Official Discord Server</a></strong>
      <br />
      <sub>Join our community for updates, MCP setup help, alternate history campaign stories, and new scenario suggestions:</sub>
      <br /><br />
      <a href="https://discord.gg/pZSkGpW2yK"><code>https://discord.gg/pZSkGpW2yK</code></a>
    </td>
    <td align="center" width="50%">
      <a href="https://github.com/Mur4t0">
        <img src="public/images/community/mur4t0-avatar.png" width="76" alt="Mur4t (@Mur4t0)" style="border-radius:50%;" />
      </a>
      <br />
      <strong><a href="https://github.com/Mur4t0">⚡ Mur4t (@Mur4t0)</a></strong>
      <br />
      <sub>Creator of Mur4History • Vibe Coding &amp; Grand Strategy Simulations</sub>
      <br /><br />
      <a href="https://github.com/Mur4t0"><code>github.com/Mur4t0</code></a> • <a href="https://mur4offsets.github.io"><code>mur4offsets.github.io</code></a>
    </td>
  </tr>
</table>

---

## Story & Vision (Made in Türkiye & Vibe Coding)

**Mur4History** is an open-source **grand strategy and alternate history sandbox** created in **Türkiye**, built from the ground up through **Vibe Coding** (combining human game design vision with rapid AI-assisted engineering and iteration).

Unlike conventional AI strategy games, Mur4History requires **zero server-side LLM API keys, subscriptions, or paid token credits**. Instead, it connects directly to your existing AI assistant (**Antigravity**, **Cursor**, **Claude Desktop**, **Cline**, etc.) via the **Model Context Protocol (MCP)**, turning your own AI into the autonomous **Head Game Master & World Simulation Engine**.

---

## Key Features

- **100% Free & Zero-Idle-Token MCP Architecture**
  - Universal Lobby (`/api/mcp/lobby`) and per-session `Streamable HTTP` (`/api/mcp/<sessionId>`) + `Legacy SSE` (`/api/mcp/<sessionId>/sse`) endpoints.
  - `wait_for_player_action` holds the connection open **indefinitely** at zero idle token burn while you plan on the map, waking up in milliseconds the moment you click Complete Turn, Leader Send, Council Send, or AI Advisor.
  - **14 MCP Tools & 9 MCP Resources** give your AI full command over territorial transfers, national stats, diplomacy, animated map facilities, world newspapers, 1-on-1 leader talks, multilateral councils, and strategy brainstorming.
  - **Strict MCP Lock Gate & Home Onboarding Hub**: Entering scenarios or sessions is locked until an MCP client connects; the home screen includes a live status detector, 3-step visual tutorial, and a 1-click **All-in-One AI Setup & Full Game Introduction Prompt**.
- **12 Official Historical Preset Scenarios**
  - `2026: Modern Geopolitics` (1 Month/Turn)
  - `1991: End of the Cold War` (1 Month/Turn)
  - `1962: Cold War` (1 Month/Turn)
  - `1942: Stalingrad & El Alamein` (1 Month/Turn)
  - `1939: World War II` (1 Month/Turn)
  - `1936: Gathering Storm` (2 Months/Turn)
  - `1919: Turkish War of Independence` (1 Month/Turn)
  - `1914: World War I` (1 Month/Turn)
  - `1877: 93 War & Siege of Plevna` (1 Month/Turn)
  - `1812: Napoleonic Wars` (2 Months/Turn)
  - `1526: Suleiman & Battle of Mohács` (3 Months/Turn)
  - `1444: Dawn of Empires` (6 Months/Turn)
- **Interactive MapLibre GL World Map**
  - **270 interactive world provinces**, continental/ocean relief shading, and curved cartographic country labels.
  - **14 live map themes** (`Pax Imperial Atlas`, `Mur4History Classic`, `Victoria Parchment (1836)`, `Physical Relief & Topography`, etc.).
  - **8 procedural Web Audio API background tracks** with volume and mute controls.
  - AI-managed **animated map landmarks & beacons** (`INDUSTRY`, `MILITARY`, `INFRASTRUCTURE`, `NAVAL`, `RESEARCH`, `DIPLOMACY`, `INTERNAL`, `CRISIS`).
- **Diplomacy Hall, Multilateral Councils & AI Strategy Advisor**
  - **1-on-1 live leader chats** with foreign heads of state (`reply_leader_chat`).
  - **Multi-nation diplomatic councils & coalition summits** (`convene_diplomatic_council`, `reply_diplomatic_council`).
  - **AI Strategy Advisor & War Room** (`reply_advisor_chat`) with one-click actionable `suggested_orders` cards without advancing the turn.
- **Smart World Gazette, Diplomatic Telegraph Archive & Time-Travel Rollback**
  - Latest turn events stay pinned at the top (**`CURRENT` / `LATEST`**), while older turns fold into searchable **`ARCHIVE` / `OLD`** groups.
  - Instant search and grouping by turn, topic, country, or year across Newspaper, Messages, and Chronicle tabs.
  - Full turn snapshot **Rollback / Time Travel** to any previous turn.
- **Browser Saves & Drag-and-Drop Portable `.mur4history.json` Archives**
  - Save campaigns in browser storage (**IndexedDB**) or download portable `.mur4history.json` files and drag-and-drop them onto the lobby to restore everything instantly.
- **Bilingual UI & Dynamic Bilingual MCP Directives (`TR | EN`)**
  - Automatically detects browser language (`tr` -> Turkish; any other language -> English) with an instant `TR | EN` toggle. Switching the UI language dynamically switches all MCP system prompts, resource metadata, and tool instructions to English or Turkish.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling & UI**: Tailwind CSS v4, Radix UI, Lucide Icons
- **Map Engine**: MapLibre GL JS, `world-atlas`, `topojson-client`, `polygon-clipping`
- **Database**: Prisma ORM + SQLite (`prisma/schema.prisma`)
- **AI / Protocol**: `@modelcontextprotocol/sdk` (Streamable HTTP + Legacy SSE + `scripts/mcp-stdio.mjs` bridge) + Server-Sent Events (SSE)
- **Audio**: Built-in Web Audio API procedural ambient soundtrack synthesizer

---

## Installation & Quick Start

### 1. Local Setup (Node.js 20+)

```bash
git clone https://github.com/Mur4t0/Mur4History.git
cd Mur4History

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Build GeoJSON map, push Prisma SQLite schema, and seed all 12 official scenarios
npm run setup

# Start development server (http://localhost:3000)
npm run dev
```

> **One-Click Windows Launcher:** Double-click `Mur4History-Play.bat` in the repository root to automatically install, build, and launch `localhost:3000`, and use `Mur4History-Stop.bat` to stop the background server.

> [!IMPORTANT]
> **IMPORTANT — Customize `Mur4History-Play.bat` and `Mur4History-Stop.bat` for Your Own PC:**
> Before running the Windows `.bat` scripts after cloning, review and adapt them to match your local machine and directory layout:
> 1. **Folder Name & Process Filter (`Mur4History-Stop.bat`)**: The PowerShell stop command filters `node.exe` Next.js processes whose command line matches `Mur4History|paxhistoryMur4t`. If you cloned the repository into a differently named folder (e.g., `C:\Games\MyStrategyGame`), update that filter pattern to match your folder name.
> 2. **Port Number (`Mur4History-Play.bat`)**: Both scripts default to port `3000` (`--port 3000` and `http://127.0.0.1:3000` / `http://localhost:3000`). If port `3000` is already in use on your machine, update the port in the `.bat` files, your `.env` file, and your MCP client URL.
> 3. **Working Directory & Node.js `PATH`**: `Mur4History-Play.bat` runs from its own directory (`%~dp0`) and checks `where node` on your system `PATH`. If Node.js 20+ is installed in a custom path or if you move the `.bat` files to your Desktop, update the working directory and `node` executable paths accordingly.
> 4. **Environment File (`.env`)**: Make sure to create your `.env` file from `.env.example` (`copy .env.example .env`) on first setup.

### 2. Run via GitHub Packages (Docker / GHCR)

This repository includes a production `Dockerfile` and GitHub Actions workflow (`.github/workflows/docker-publish.yml`) for GitHub Container Registry (`ghcr.io`):

```bash
docker run -d \
  --name mur4history \
  -p 3000:3000 \
  -v mur4history_data:/app/prisma/data \
  ghcr.io/mur4t0/mur4history:latest
```

Then open `http://localhost:3000` in your browser.

---

## Connecting Your MCP AI Client

You can copy the **All-in-One AI Setup & Full Game Introduction Prompt** directly from the home screen to let your AI configure itself automatically, or use one of the manual configs below:

- **Local Stdio Bridge (Antigravity / Cursor / Claude Desktop)**:
  ```json
  {
    "mcpServers": {
      "mur4history": {
        "command": "node",
        "args": ["C:/YOUR_LOCAL_PATH/Mur4History/scripts/mcp-stdio.mjs"]
      }
    }
  }
  ```
- **Cursor / Streamable HTTP (Universal Lobby Endpoint)**:
  ```json
  {
    "mcpServers": {
      "mur4history": {
        "url": "http://localhost:3000/api/mcp/lobby"
      }
    }
  }
  ```
- **Claude Desktop (`mcp-remote`)**:
  ```json
  {
    "mcpServers": {
      "mur4history": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp/lobby"]
      }
    }
  }
  ```

---

## About GitHub Packages & GitHub Pages

1. **GitHub Packages (GHCR)**: Pushing to `main` triggers `.github/workflows/docker-publish.yml` to build and publish the Docker image under `ghcr.io/mur4t0/mur4history`.
2. **GitHub Pages (Static Showcase)**: Because GitHub Pages only hosts static HTML/CSS/JS, it cannot directly execute Next.js API routes, Prisma/SQLite, or the live MCP server. The `docs/` directory and `.github/workflows/pages.yml` provide an official bilingual (`TR | EN`) showcase and documentation site for **GitHub Pages**.

---

## End-to-End Verification

While the server is running (`npm run dev` or `npm run start`), run the full 8-step automated verification suite (covering all 12 scenarios, Streamable HTTP + Legacy SSE, Advisor, Leader/Council chats, Map Markers, Save Export/Import, Time-Travel Rollback, and Dynamic English MCP Switching):

```bash
node scripts/verify-mcp-e2e.mjs
```

---

## License

Released as open source under the **MIT License**. See [LICENSE](LICENSE) for full details.
