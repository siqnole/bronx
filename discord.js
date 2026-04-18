const axios = require('axios');
const { cache } = require('./cache');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const inflightRequests = new Map();
let discordRateLimitedUntil = 0;

/**
 * Generic Discord API fetcher with:
 *  - Per-key caching
 *  - In-flight deduplication
 *  - Global 429 backoff
 */
async function cachedDiscordFetch(cacheKey, url, ttlSeconds = 300) {
    if (Date.now() < discordRateLimitedUntil) {
        return null;
    }

    const cached = await cache.get(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    if (!process.env.DISCORD_TOKEN) return null;

    if (inflightRequests.has(cacheKey)) {
        return inflightRequests.get(cacheKey);
    }

    const promise = (async () => {
        try {
            const resp = await axios.get(url, {
                headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                timeout: 10000
            });
            await cache.set(cacheKey, resp.data, ttlSeconds);
            return resp.data;
        } catch (e) {
            if (e.response?.status === 429) {
                const retryAfter = (e.response.data?.retry_after || e.response.headers?.['retry-after'] || 60) * 1000;
                discordRateLimitedUntil = Date.now() + retryAfter;
                console.warn(`[Discord] Rate limited — backing off for ${retryAfter / 1000}s`);
            } else {
                console.warn(`[Discord] ${url} failed:`, e.response?.status || e.message);
            }
            return null;
        } finally {
            inflightRequests.delete(cacheKey);
        }
    })();

    inflightRequests.set(cacheKey, promise);
    return promise;
}

/**
 * Get guild info (member count, etc.) — cached for 5 minutes.
 */
async function getGuildInfo(guildId) {
    return cachedDiscordFetch(
        `discord:guild_info:${guildId}`,
        `${DISCORD_API_BASE}/guilds/${guildId}?with_counts=true`,
        300
    );
}

/**
 * Get guild member IDs for economy scoping — cached for 10 minutes.
 * Returns array of user ID strings, or null on failure.
 */
async function getGuildMemberIds(guildId) {
    const data = await cachedDiscordFetch(
        `discord:member_ids:${guildId}`,
        `${DISCORD_API_BASE}/guilds/${guildId}/members?limit=1000`,
        600 // 10 min
    );
    return data ? data.map(m => m.user.id) : null;
}

/**
 * Update the global rate limit timer.
 */
function setDiscordRateLimit(retryAfterMs) {
    discordRateLimitedUntil = Date.now() + retryAfterMs;
    console.warn(`[Discord] Global rate limit set for ${retryAfterMs / 1000}s`);
}

/**
 * Resolve Discord member info (username, avatar) for a guild.
 */
async function resolveGuildMembers(guildId) {
    const memberMap = {};
    if (!guildId) return memberMap;
    try {
        const cacheKey = `discord:members:${guildId}`;
        let members = await cache.get(cacheKey);
        if (!members && process.env.DISCORD_TOKEN && Date.now() >= discordRateLimitedUntil) {
            members = [];
            let after = '0';
            for (let page = 0; page < 10; page++) {
                try {
                    const resp = await axios.get(
                        `${DISCORD_API_BASE}/guilds/${guildId}/members?limit=1000&after=${after}`, {
                        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
                        timeout: 10000
                    });
                    const batch = resp.data;
                    if (!batch || batch.length === 0) break;
                    members.push(...batch.map(m => ({
                        id: m.user.id,
                        username: m.user.username,
                        display_name: m.nick || m.user.global_name || m.user.username,
                        avatar: m.user.avatar
                    })));
                    if (batch.length < 1000) break;
                    after = batch[batch.length - 1].user.id;
                } catch (e) {
                    if (e.response?.status === 429) {
                        const retryAfter = (e.response.data?.retry_after || 60) * 1000;
                        setDiscordRateLimit(retryAfter);
                    }
                    break;
                }
            }
            if (members.length > 0) {
                await cache.set(cacheKey, members, 300);
            }
        }
        if (members) {
            for (const m of members) {
                memberMap[m.id] = {
                    ...m,
                    avatar_url: m.avatar
                        ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.${m.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`
                        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(m.id) >> 22n) % 6n}.png`,
                    proxy_avatar_url: m.avatar
                        ? `/api/proxy/avatar/${m.id}?hash=${m.avatar}&size=64`
                        : `/api/proxy/avatar/${m.id}`
                };
            }
        }
    } catch (e) {
        console.warn('resolveGuildMembers failed:', e.message);
    }
    return memberMap;
}

/**
 * Resolve Discord channel names for a guild.
 */
async function resolveGuildChannels(guildId) {
    const channelMap = {};
    if (!guildId) return channelMap;
    try {
        const data = await cachedDiscordFetch(
            `discord:channels:${guildId}`,
            `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
            600
        );
        if (data) {
            for (const ch of data) channelMap[ch.id] = ch.name;
        }
    } catch (e) {
        console.warn('resolveGuildChannels failed:', e.message);
    }
    return channelMap;
}

module.exports = {
    getGuildInfo,
    getGuildMemberIds,
    resolveGuildMembers,
    resolveGuildChannels,
    cachedDiscordFetch,
    setDiscordRateLimit,
    getDiscordRateLimitedUntil: () => discordRateLimitedUntil
};
