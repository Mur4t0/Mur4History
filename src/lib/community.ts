export const CREATOR_GITHUB_URL = "https://github.com/Mur4t0";
export const CREATOR_DISCORD_URL = "https://discord.gg/pZSkGpW2yK";

export interface CommunityShowcaseData {
  github: {
    login: string;
    name: string;
    avatarUrl: string;
    fallbackAvatarUrl: string;
    htmlUrl: string;
    blog: string | null;
    bio: string | null;
    publicRepos: number;
    followers: number;
    following: number;
    createdAt: string;
  };
  discord: {
    inviteCode: string;
    inviteUrl: string;
    guildName: string;
    iconUrl: string;
    fallbackIconUrl: string;
    memberCount: number;
    onlineCount: number;
  };
}

export const DEFAULT_COMMUNITY_DATA: CommunityShowcaseData = {
  github: {
    login: "Mur4t0",
    name: "Mur4t",
    avatarUrl: "/images/community/mur4t0-avatar.png",
    fallbackAvatarUrl: "/images/community/mur4t0-avatar.png",
    htmlUrl: CREATOR_GITHUB_URL,
    blog: "mur4offsets.github.io",
    bio: null,
    publicRepos: 1,
    followers: 1,
    following: 3,
    createdAt: "2022-06-23T20:05:54Z",
  },
  discord: {
    inviteCode: "pZSkGpW2yK",
    inviteUrl: CREATOR_DISCORD_URL,
    guildName: "Mur4Code",
    iconUrl: "/images/community/mur4code-icon.png",
    fallbackIconUrl: "/images/community/mur4code-icon.png",
    memberCount: 14,
    onlineCount: 13,
  },
};

interface CachedCommunity {
  data: CommunityShowcaseData;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const globalForCommunity = globalThis as unknown as {
  __mur4CommunityCache?: CachedCommunity;
};

export async function getCommunityProfileData(): Promise<CommunityShowcaseData> {
  const cached = globalForCommunity.__mur4CommunityCache;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const next: CommunityShowcaseData = {
    github: { ...DEFAULT_COMMUNITY_DATA.github },
    discord: { ...DEFAULT_COMMUNITY_DATA.discord },
  };

  await Promise.all([
    (async () => {
      try {
        const res = await fetch("https://api.github.com/users/Mur4t0", {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Mur4History-Web",
          },
          signal: AbortSignal.timeout(3000),
          cache: "no-store",
        });
        if (!res.ok) return;
        const gh = (await res.json()) as {
          login?: string;
          name?: string;
          avatar_url?: string;
          html_url?: string;
          blog?: string;
          bio?: string | null;
          public_repos?: number;
          followers?: number;
          following?: number;
          created_at?: string;
        };
        if (gh.login) next.github.login = gh.login;
        if (gh.name) next.github.name = gh.name;
        if (gh.avatar_url) next.github.avatarUrl = gh.avatar_url;
        if (gh.html_url) next.github.htmlUrl = gh.html_url;
        if (gh.blog) next.github.blog = gh.blog;
        if (gh.bio) next.github.bio = gh.bio;
        if (typeof gh.public_repos === "number") {
          next.github.publicRepos = gh.public_repos;
        }
        if (typeof gh.followers === "number") {
          next.github.followers = gh.followers;
        }
        if (typeof gh.following === "number") {
          next.github.following = gh.following;
        }
        if (gh.created_at) next.github.createdAt = gh.created_at;
      } catch {
        // Keep clean local fallback metadata & local PP
      }
    })(),
    (async () => {
      try {
        const res = await fetch(
          "https://discord.com/api/v10/invites/pZSkGpW2yK?with_counts=true",
          {
            signal: AbortSignal.timeout(3000),
            cache: "no-store",
          }
        );
        if (!res.ok) return;
        const dc = (await res.json()) as {
          guild?: { id?: string; name?: string; icon?: string | null };
          approximate_member_count?: number;
          approximate_presence_count?: number;
        };
        if (dc.guild?.name) next.discord.guildName = dc.guild.name;
        if (dc.guild?.id && dc.guild?.icon) {
          next.discord.iconUrl = `https://cdn.discordapp.com/icons/${dc.guild.id}/${dc.guild.icon}.png?size=256`;
        }
        if (typeof dc.approximate_member_count === "number") {
          next.discord.memberCount = dc.approximate_member_count;
        }
        if (typeof dc.approximate_presence_count === "number") {
          next.discord.onlineCount = dc.approximate_presence_count;
        }
      } catch {
        // Keep clean local fallback metadata & icon
      }
    })(),
  ]);

  globalForCommunity.__mur4CommunityCache = {
    data: next,
    fetchedAt: Date.now(),
  };

  return next;
}
