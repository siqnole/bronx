/**
 * Bronx Bot - Discord OAuth2 Token Exchange Proxy
 * Uses classic addEventListener syntax for Cloudflare's drag-and-drop deployer.
 */

const DISCORD_TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const body = await request.text();

        const discordResponse = await fetch(DISCORD_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'BronxBot-OAuth-Proxy/1.0',
            },
            body: body,
        });

        const responseBody = await discordResponse.text();

        const headers = new Headers({
            'Content-Type': discordResponse.headers.get('Content-Type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
        });

        // Forward rate limit headers so backend retry logic still works
        const retryAfter = discordResponse.headers.get('retry-after');
        if (retryAfter) headers.set('Retry-After', retryAfter);

        return new Response(responseBody, {
            status: discordResponse.status,
            headers: headers,
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: 'proxy_error', message: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
