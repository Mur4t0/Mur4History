"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  ExternalLink,
  FolderGit2,
  Globe,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useLocale } from "@/components/LanguageProvider";
import type { CommunityShowcaseData } from "@/lib/community";

export function DiscordLogoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function CommunityNavBadges({
  data,
}: {
  data: CommunityShowcaseData;
}) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [avatarSrc, setAvatarSrc] = useState(data.github.avatarUrl);

  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <a
        href={data.discord.inviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="nav-discord-link"
        title={
          isEn
            ? `Join ${data.discord.guildName} Discord`
            : `${data.discord.guildName} Discord Sunucusuna Katıl`
        }
        className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 transition hover:-translate-y-0.5 hover:border-cyan-400/55 hover:bg-indigo-500/25 hover:text-white"
      >
        <DiscordLogoIcon className="h-3.5 w-3.5 text-[#7289da] transition-transform duration-300 group-hover:scale-110 group-hover:text-cyan-300" />
        <span>Discord</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </a>

      <a
        href={data.github.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="nav-github-link"
        title={
          isEn
            ? `Creator GitHub: @${data.github.login}`
            : `Geliştirici GitHub: @${data.github.login}`
        }
        className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] py-0.5 pl-1 pr-2.5 text-[11px] font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:border-amber-300/45 hover:bg-white/[0.09] hover:text-white"
      >
        <img
          src={avatarSrc}
          alt={data.github.login}
          onError={() => {
            if (avatarSrc !== data.github.fallbackAvatarUrl) {
              setAvatarSrc(data.github.fallbackAvatarUrl);
            }
          }}
          className="h-5 w-5 rounded-full object-cover ring-1 ring-amber-300/50 transition-transform duration-300 group-hover:scale-110"
        />
        <span>@{data.github.login}</span>
      </a>
    </div>
  );
}

export function CreatorCommunityShowcase({
  data,
}: {
  data: CommunityShowcaseData;
}) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const [avatarSrc, setAvatarSrc] = useState(data.github.avatarUrl);
  const [discordIconSrc, setDiscordIconSrc] = useState(data.discord.iconUrl);

  const memberSinceYear = data.github.createdAt.slice(0, 4) || "2022";
  const blogUrl = data.github.blog
    ? data.github.blog.startsWith("http")
      ? data.github.blog
      : `https://${data.github.blog}`
    : null;

  return (
    <section
      aria-label={isEn ? "Community and Creator" : "Topluluk ve Geliştirici"}
      data-testid="community-creator-showcase"
      className="w-full space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h2 className="font-serif text-base font-bold tracking-wide text-white sm:text-lg">
            {isEn ? "Community & Creator" : "Topluluk & Geliştirici"}
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          {isEn
            ? "Join the live Discord & follow development on GitHub"
            : "Canlı Discord topluluğuna katıl ve geliştirmeyi GitHub'dan takip et"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ============================================================
            DISCORD COMMUNITY CARD (Mur4Code)
           ============================================================ */}
        <a
          href={data.discord.inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="discord-community-card"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-indigo-400/35 bg-gradient-to-br from-[#0e1430]/95 via-[#090d1b]/95 to-[#06131f]/95 p-5 shadow-[0_18px_50px_rgba(79,70,229,0.16)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/55 hover:shadow-[0_24px_60px_rgba(34,211,238,0.22)]"
        >
          {/* Ambient Animated Orbs & Diagonal Sheen */}
          <div
            aria-hidden="true"
            className="animate-mur4-glow pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/30 via-cyan-400/20 to-transparent blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="animate-mur4-shimmer h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="animate-mur4-orbit absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[#5865F2] via-cyan-400 to-purple-500 opacity-75 blur-[2px]"
                />
                <img
                  src={discordIconSrc}
                  alt={data.discord.guildName}
                  onError={() => {
                    if (discordIconSrc !== data.discord.fallbackIconUrl) {
                      setDiscordIconSrc(data.discord.fallbackIconUrl);
                    }
                  }}
                  className="relative h-16 w-16 rounded-2xl border border-white/20 bg-[#05070e] object-cover shadow-xl transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#090d1b] ring-2 ring-[#090d1b]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="absolute h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-[#5865F2]/20 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-indigo-200">
                  <DiscordLogoIcon className="h-3 w-3 text-[#8ea1e1]" />
                  {isEn ? "Official Discord" : "Resmi Discord"}
                </div>
                <h3 className="mt-1.5 font-serif text-xl font-bold text-white transition-colors group-hover:text-cyan-200">
                  {data.discord.guildName}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {data.discord.onlineCount}{" "}
                    {isEn ? "Online" : "Çevrimiçi"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Users className="h-3.5 w-3.5 text-indigo-300" />
                    {data.discord.memberCount}{" "}
                    {isEn ? "Members" : "Üye"}
                  </span>
                </div>
              </div>
            </div>

            <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cyan-300" />
          </div>

          <p className="relative z-10 mt-4 text-xs leading-relaxed text-slate-300">
            {isEn
              ? "Join Mur4Code to share custom campaign stories, test new MCP setups, get support, and suggest new historical eras directly."
              : "Güncellemeleri takip etmek, MCP kurulum desteği almak, strateji hikayelerini paylaşmak ve yeni senaryo önermek için Mur4Code sunucumuza katıl."}
          </p>

          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3.5">
            <code className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-[11px] text-cyan-200">
              discord.gg/{data.discord.inviteCode}
            </code>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5865F2] to-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-[1.03]">
              <DiscordLogoIcon className="h-3.5 w-3.5" />
              {isEn ? "Join Server" : "Sunucuya Katıl"}
            </span>
          </div>
        </a>

        {/* ============================================================
            MODERN GITHUB DEVELOPER PROFILE CARD (@Mur4t0)
           ============================================================ */}
        <div
          data-testid="github-profile-card"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-[#121620]/95 via-[#0b0f17]/95 to-[#17110d]/95 p-5 shadow-[0_18px_50px_rgba(207,127,86,0.14)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:shadow-[0_24px_60px_rgba(207,127,86,0.22)]"
        >
          {/* Ambient Animated Copper Aura & Subtle Tech Grid */}
          <div
            aria-hidden="true"
            className="animate-mur4-glow pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-gradient-to-tl from-[#cf7f56]/30 via-[#efe3c8]/15 to-transparent blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="animate-mur4-shimmer h-full w-1/3 bg-gradient-to-r from-transparent via-amber-200/[0.05] to-transparent" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Rotating Metallic Halo Around Real GitHub PP */}
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="animate-mur4-orbit absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,#efe3c8,#cf7f56,#38bdf8,#efe3c8)] opacity-85 blur-[1.5px]"
                />
                <img
                  src={avatarSrc}
                  alt={`${data.github.name} (@${data.github.login})`}
                  data-testid="github-creator-avatar"
                  onError={() => {
                    if (avatarSrc !== data.github.fallbackAvatarUrl) {
                      setAvatarSrc(data.github.fallbackAvatarUrl);
                    }
                  }}
                  className="relative h-16 w-16 rounded-full border-2 border-[#0b0f17] object-cover shadow-xl transition-transform duration-300 group-hover:scale-105"
                />
                <span
                  title="GitHub Active Developer"
                  className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#0b0f17] ring-2 ring-[#0b0f17]"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                    GitHub
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                    <Zap className="h-3 w-3 text-amber-300" />
                    {isEn ? "Creator" : "Geliştirici"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif text-xl font-bold text-[#efe3c8]">
                    {data.github.name}
                  </h3>
                  <span className="font-mono text-xs font-medium text-[#cf7f56]">
                    @{data.github.login}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  {data.github.bio ||
                    (isEn
                      ? "Creator of Mur4History • Vibe Coding & Grand Strategy"
                      : "Mur4History geliştiricisi • Vibe Coding & Büyük Strateji")}
                </p>
              </div>
            </div>

            <a
              href={data.github.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open GitHub @${data.github.login}`}
              className="rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-slate-300 transition hover:border-amber-300/50 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Bento Stats Row */}
          <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                <FolderGit2 className="h-3 w-3 text-amber-300" />
                <span>{isEn ? "Repos" : "Repo"}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-white">
                {data.github.publicRepos}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                <Users className="h-3 w-3 text-sky-300" />
                <span>{isEn ? "Followers" : "Takipçi"}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-white">
                {data.github.followers}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                <Calendar className="h-3 w-3 text-emerald-300" />
                <span>{isEn ? "Since" : "Katılım"}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-white">
                {memberSinceYear}
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3.5">
            {blogUrl ? (
              <a
                href={blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-amber-300/45 hover:text-amber-200"
              >
                <Globe className="h-3 w-3 text-[#cf7f56]" />
                {data.github.blog}
              </a>
            ) : (
              <span className="font-mono text-[11px] text-slate-400">
                github.com/{data.github.login}
              </span>
            )}

            <a
              href={data.github.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#efe3c8] to-[#cf7f56] px-3.5 py-1.5 text-xs font-bold text-[#090b10] shadow-md transition-transform duration-300 hover:scale-[1.03]"
            >
              {isEn ? "View GitHub Profile" : "GitHub Profiline Git"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
