<div align="center">
  <img src="public/images/brand/mur4history-logo.png" alt="Mur4History Logo" width="380" />

  <h3>Alternatif Tarih & Büyük Strateji MCP Simülasyon Platformu</h3>
  <p><em>Alternate History &amp; Grand Strategy MCP Simulation Platform</em></p>

  <p>
    <strong>🇹🇷 Türkçe (Aktif)</strong> • <a href="README.en.md"><strong>🇬🇧 Read in English (README.en.md)</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/T%C3%BCrk%20Yap%C4%B1m%C4%B1-Made%20in%20T%C3%BCrkiye-E30A17?style=for-the-badge" alt="Türk Yapımı" />
    <img src="https://img.shields.io/badge/Built%20with-Vibe%20Coding%20%E2%9A%A1-8B5CF6?style=for-the-badge" alt="Built with Vibe Coding" />
    <img src="https://img.shields.io/badge/Protocol-Native%20MCP-10B981?style=for-the-badge" alt="Native MCP" />
    <img src="https://img.shields.io/badge/Languages-TR%20%7C%20EN-F59E0B?style=for-the-badge" alt="Turkish and English" />
    <img src="https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge" alt="MIT License" />
  </p>

  <p>
    <a href="https://discord.gg/pZSkGpW2yK">
      <img src="https://img.shields.io/badge/Discord-Mur4Code%20Toplulu%C4%9Fu-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Mur4Code" />
    </a>
    <a href="https://github.com/Mur4t0">
      <img src="https://img.shields.io/badge/GitHub-@Mur4t0-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub @Mur4t0" />
    </a>
  </p>
</div>

---

## Topluluk & Geliştirici (Community & Creator)

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://discord.gg/pZSkGpW2yK">
        <img src="public/images/community/mur4code-icon.png" width="76" alt="Mur4Code Discord" style="border-radius:16px;" />
      </a>
      <br />
      <strong><a href="https://discord.gg/pZSkGpW2yK">💬 Mur4Code Resmi Discord Sunucusu</a></strong>
      <br />
      <sub>Güncellemeleri takip etmek, MCP kurulum desteği almak, senaryo fikirleri paylaşmak ve topluluğa katılmak için:</sub>
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
      <sub>Mur4History Geliştiricisi • Vibe Coding &amp; Büyük Strateji Simülasyonları</sub>
      <br /><br />
      <a href="https://github.com/Mur4t0"><code>github.com/Mur4t0</code></a> • <a href="https://mur4offsets.github.io"><code>mur4offsets.github.io</code></a>
    </td>
  </tr>
</table>

---

## Hikaye & Vizyon (Türk Yapımı & Vibe Coding)

**Mur4History**, **Türkiye**'den çıkmış, baştan sona **Vibe Coding** yaklaşımıyla (insan oyun tasarımı vizyonu + yapay zeka destekli hızlı prototipleme ve iterasyon) geliştirilmiş, açık kaynaklı bir **büyük strateji ve alternatif tarih sandbox** platformudur.

Klasik yapay zeka oyunlarının aksine sunucu tarafında hiçbir LLM API anahtarı veya ücretli kredi/token sistemi bulundurmaz. Bunun yerine doğrudan **Model Context Protocol (MCP)** standardı üzerinden sizin mevcut yapay zeka istemcinizi (**Antigravity**, **Cursor**, **Claude Desktop**, **Cline** vb.) oyunun **Game Master / Dünya Simülatörü** olarak bağlar.

---

## Öne Çıkan Özellikler

- **%100 Ücretsiz & Sıfır Idle Token Tüketen MCP Mimarisi**
  - Lobi (`/api/mcp/lobby`) ve her oyun oturumu için `Streamable HTTP` (`/api/mcp/<sessionId>`) ile `Legacy SSE` (`/api/mcp/<sessionId>/sse`) uç noktaları açılır.
  - `wait_for_player_action` aracı, oyuncu siteden yeni bir hamle, mesaj veya soru gönderene kadar **süresiz** beklemede kalır; beklerken fazladan token tüketmez, oyuncu aksiyon aldığı anda milisaniyeler içinde uyanır.
  - **14 MCP Aracı & 9 MCP Kaynağı** ile sınır değişiminden diplomasiye, danışman sohbetlerinden konsey toplantılarına kadar tam kontrol sunar.
  - **MCP Bağlantı Kilidi & Ana Sayfa Onboarding Hub**: MCP istemcisi bağlanmadan oyuna veya senaryolara girilemez; ana sayfada canlı bağlantı durumu, kurulum rehberi ve AI'ya tek tıkla kopyalanabilen **Otomatik Kurulum + Tam Oyun Tanıtım Promptu** hazır gelir.
- **12 Resmi Tarihsel Preset Senaryo**
  - `2026: Modern Jeopolitik` (1 Ay/Tur)
  - `1991: Soğuk Savaş'ın Sonu` (1 Ay/Tur)
  - `1962: Soğuk Savaş` (1 Ay/Tur)
  - `1942: Stalingrad & El Alamein` (1 Ay/Tur)
  - `1939: II. Dünya Savaşı` (1 Ay/Tur)
  - `1936: Fırtına Öncesi` (2 Ay/Tur)
  - `1919: Türk Kurtuluş Savaşı` (1 Ay/Tur)
  - `1914: I. Dünya Savaşı` (1 Ay/Tur)
  - `1877: 93 Harbi & Plevne` (1 Ay/Tur)
  - `1812: Napolyon Savaşları` (2 Ay/Tur)
  - `1526: Kanuni & Mohaç` (3 Ay/Tur)
  - `1444: Yeni Çağ` (6 Ay/Tur)
- **MapLibre GL Tabanlı İnteraktif Dünya Haritası**
  - **270 etkileşimli dünya eyaleti**, kıta/deniz kabartma gölgelemeleri ve kavisli kartografik ülke etiketleri.
  - **14 farklı canlı harita teması** (`Pax Imperial Atlas`, `Mur4History Klasik`, `Victoria Parchment (1836)`, `Fiziksel Rölyef`, vb.).
  - **8 dahili Web Audio API fon müziği** ve ses düzeyi / açma-kapama kontrolleri.
  - AI tarafından yönetilen **animasyonlu harita işaretçileri** (`INDUSTRY`, `MILITARY`, `INFRASTRUCTURE`, `NAVAL`, `RESEARCH`, `DIPLOMACY`, `INTERNAL`, `CRISIS`).
- **Diplomasi Salonu, Çok Uluslu Konseyler & AI Danışman**
  - Ülke başkanlarıyla **bire bir canlı mesajlaşma** (`reply_leader_chat`).
  - Birden fazla ülkenin aynı krizde bir araya geldiği **çok uluslu konsey/koalisyon zirveleri** (`convene_diplomatic_council`, `reply_diplomatic_council`).
  - Turu ilerletmeden strateji danışabileceğiniz ve tek tıkla emir kuyruğuna ekleyebileceğiniz **AI Strateji Danışmanı** (`reply_advisor_chat`).
- **Akıllı Gazete, Telgraf & Kronoloji Arşivi + Zaman Yolculuğu**
  - En günceller her zaman üstte (**`GÜNCEL` / `LATEST`**), önceki turlar ise katlanabilir **`ESKİ` / `OLD`** gruplarında toplanır.
  - `Gazete`, `Mesaj` ve `Kronoloji` sekmelerinde tura, konuya/ülkeye/yıla göre gruplama ve gerçek zamanlı arama desteği.
  - Önceki herhangi bir turun anlık yedeğine geri dönme (**Rollback / Zaman Yolculuğu**).
- **Tam İlerleme Kaydı & Sürükle-Bırak İçe Aktarma**
  - Kampanyanızı tarayıcı içine (**IndexedDB**) kaydedin ya da taşınabilir `.mur4history.json` dosyası olarak bilgisayarınıza indirip lobiye sürükleyip bırakarak eksiksiz geri yükleyin.
- **Türkçe & İngilizce (TR | EN) İki Dilli Arayüz & MCP Çıktıları**
  - Tarayıcı dili Türkçe (`tr`) ise otomatik **Türkçe**, İngilizce veya farklı bir dil ise otomatik **İngilizce** açılır; arayüzdeki `TR | EN` anahtarıyla dil değiştirildiğinde MCP'ye giden tüm sistem promptları, kaynaklar ve araç yönergeleri de seçili dile otomatik geçer.

---

## Teknoloji Yığını (Tech Stack)

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Tasarım & UI**: Tailwind CSS v4, Radix UI, Lucide Icons
- **Harita Motoru**: MapLibre GL JS, `world-atlas`, `topojson-client`, `polygon-clipping`
- **Veritabanı**: Prisma ORM + SQLite (`prisma/schema.prisma`)
- **AI / Protokol**: `@modelcontextprotocol/sdk` (Streamable HTTP + Legacy SSE + `scripts/mcp-stdio.mjs` köprüsü) + Server-Sent Events (SSE)
- **Ses**: Dahili Web Audio API prosedürel fon müziği sentezleyicisi

---

## Kurulum & Çalıştırma

### 1. Lokal Kurulum (Node.js 20+)

```bash
git clone https://github.com/Mur4t0/Mur4History.git
cd Mur4History

# Ortam değişkenlerini oluşturun
cp .env.example .env

# Bağımlılıkları yükleyin
npm install

# GeoJSON haritasını üretin, Prisma SQLite şemasını kurun ve 12 resmi senaryoyu yükleyin
npm run setup

# Geliştirme sunucusunu başlatın (http://localhost:3000)
npm run dev
```

> **Windows Kullanıcıları İçin Tek Tıkla Başlatma:** Depo içindeki `Mur4History-Play.bat` dosyasına çift tıklayarak kurulum + derleme + `localhost:3000` başlatma adımlarını otomatik çalıştırabilir, `Mur4History-Stop.bat` ile durdurabilirsiniz.

> [!IMPORTANT]
> **ÖNEMLİ — Başlat / Durdur `.bat` Dosyalarını Kendi Bilgisayarınıza Göre Düzenleyin:**
> Depoyu klonladıktan sonra doğrudan çift tıklamadan önce `Mur4History-Play.bat` ve `Mur4History-Stop.bat` dosyalarını kendi bilgisayar ortamınıza ve klasör düzeninize göre gözden geçirip uyarlamanız gerekir:
> 1. **Klasör Adı & Süreç Filtresi (`Mur4History-Stop.bat`)**: Durdurma betiğindeki `powershell` komutu varsayılan olarak komut satırında `Mur4History` geçen `node.exe` Next.js süreçlerini kapatır (`CommandLine -match 'Mur4History|paxhistoryMur4t'`). Repoyu farklı bir klasör adıyla (örneğin `C:\Oyunlar\BenimTarihOyunum`) klonladıysanız bu ismi kendi klasör adınızla değiştirin.
> 2. **Port Numarası (`Mur4History-Play.bat`)**: Varsayılan olarak `--port 3000` ve `http://127.0.0.1:3000` / `http://localhost:3000` adresleri tanımlıdır. Bilgisayarınızda `3000` portu başka bir uygulama tarafından kullanılıyorsa `.bat` dosyalarındaki portları, `.env` dosyanızı ve MCP URL ayarlarınızı kendi portunuza göre güncelleyin.
> 3. **Çalışma Dizini & Node.js Yolu (`PATH`)**: `Mur4History-Play.bat` bulunduğu klasörde (`%~dp0`) çalışır ve `where node` ile sistem `PATH`'indeki Node.js 20+ kurulumunu arar. Node.js özel bir klasördeyse veya `.bat` dosyalarını Masaüstü gibi başka bir konuma taşıyacaksanız dizin ve `node` yollarını kendi sisteminize göre ayarlayın.
> 4. **Ortam Dosyası (`.env`)**: İlk çalıştırmadan önce kök klasörde `.env.example` dosyasını kopyalayarak kendi `.env` dosyanızı (`copy .env.example .env`) oluşturmayı unutmayın.

### 2. GitHub Packages (Docker / GHCR) ile Çalıştırma

Bu depo GitHub Container Registry (`ghcr.io`) için hazır `Dockerfile` ve GitHub Actions iş akışı (`.github/workflows/docker-publish.yml`) içerir:

```bash
docker run -d \
  --name mur4history \
  -p 3000:3000 \
  -v mur4history_data:/app/prisma/data \
  ghcr.io/mur4t0/mur4history:latest
```

Ardından tarayıcınızdan `http://localhost:3000` adresine girin.

---

## MCP İstemcisi Bağlama

Ana sayfadaki **MCP Rehberi & Uzun AI Kurulum Promptu** bölümünden tek tıkla kopyalayarak yapay zekanıza otomatik kurdurabilir veya manuel bağlayabilirsiniz:

- **Lokal Stdio Köprüsü (Antigravity / Cursor / Claude Desktop)**:
  ```json
  {
    "mcpServers": {
      "mur4history": {
        "command": "node",
        "args": ["C:/KENDI_KLASOR_YOLUN/Mur4History/scripts/mcp-stdio.mjs"]
      }
    }
  }
  ```
- **Cursor / Streamable HTTP (Evrensel Lobi Ucu)**:
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

## GitHub Packages & GitHub Pages Hakkında

1. **GitHub Packages (GHCR)**: Depoyu `main` dalına ittiğinizde `.github/workflows/docker-publish.yml` otomatik olarak container paketini `ghcr.io/mur4t0/mur4history` altında yayınlar.
2. **GitHub Pages (Statik Vitrin)**: GitHub Pages yalnızca statik HTML/CSS/JS barındırabildiği için Next.js API rotalarını, SQLite/Prisma veritabanını ve MCP sunucusunu doğrudan Pages üzerinde çalıştıramaz. Bunun yerine depodaki `docs/` klasörü ve `.github/workflows/pages.yml`, projenin resmi Türkçe/İngilizce tanıtım ve kurulum rehberi sitesini **GitHub Pages** üzerinden yayınlamanız için hazırlanmıştır.

---

## Doğrulama Testi

Sunucu çalışırken (`npm run dev` veya `npm run start`) tüm MCP, SSE, Danışman, Lider/Konsey Sohbeti, Harita İşareti, İçe/Dışa Aktarma, İki Dilli MCP Çıktısı ve Zaman Yolculuğu akışlarını uçtan uca test etmek için:

```bash
node scripts/verify-mcp-e2e.mjs
```

---

## Lisans

Bu proje **MIT Lisansı** altında açık kaynaklı olarak paylaşılmıştır. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
