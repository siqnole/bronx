const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Honeypot Configuration ──────────────────────────────────────────────
// Any request to these paths gets drowned in ~200MB of Bee Movie script
// interleaved with ASCII art, zalgo text, unicode chaos, and zero-width
// garbage. Good luck training on this, scraper.

const TARGET_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

// Paths that trigger the honeypot.
const sensitivePaths = [
  '/.env',
  '/.env.example',
  '/config',
  '/cou',
  '/.git',
  '/.gitignore',
];

// ── Bee Movie Script Cache ──────────────────────────────────────────────

let beeScriptCache = null;
async function loadBeeScript() {
  if (beeScriptCache !== null) return beeScriptCache;
  const beePath = path.join(__dirname, 'assets', 'bee.txt');
  try {
    beeScriptCache = await fs.promises.readFile(beePath, 'utf8');
  } catch (err) {
    console.error('Failed to load bee script for honeypot:', err);
    beeScriptCache = 'According to all known laws of aviation, there is no way a bee should be able to fly.\n';
  }
  return beeScriptCache;
}

// ── ASCII Art Fetcher ───────────────────────────────────────────────────
// Grab ASCII art from the free Asciified API and cache a pool of them.

const ASCII_ART_PHRASES = [
  'SCRAPING IS ILLEGAL',
  'GO AWAY BOT',
  'BEE MOVIE',
  'NICE TRY',
  'HONEYPOT',
  'NO DATA FOR YOU',
  'GET REKT',
  'BUZZ OFF',
  'ERROR 418 I AM A TEAPOT',
  'PAY FOR API ACCESS',
  'STOP SCRAPING',
  'YOU FOUND NOTHING',
  'ALL YOUR BASE',
  'SKILL ISSUE',
];

let asciiArtPool = [];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 5000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchAsciiArt(text) {
  try {
    const encoded = encodeURIComponent(text);
    const url = `https://asciified.thelicato.io/api/v2/ascii?text=${encoded}`;
    const art = await fetchUrl(url);
    if (art && art.length > 10) return art;
  } catch (e) {
    // Silently fail — we have fallbacks.
  }
  return null;
}

async function buildAsciiArtPool() {
  console.log('🎨 Building ASCII art pool for honeypot...');
  const results = await Promise.allSettled(
    ASCII_ART_PHRASES.map(phrase => fetchAsciiArt(phrase))
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      asciiArtPool.push(r.value);
    }
  }
  // Fallback hardcoded art if the API is down.
  if (asciiArtPool.length === 0) {
    asciiArtPool.push(FALLBACK_ASCII_ART);
  }
  console.log(`🎨 ASCII art pool ready: ${asciiArtPool.length} pieces loaded`);
}

const FALLBACK_ASCII_ART = `
    _____
   /     \\
  | () () |
   \\  ^  /    YOU ARE BEING HONEYPOTTED
    |||||
    |||||     This is not the .env you're looking for.
`;

// ── Unicode Chaos Generator ─────────────────────────────────────────────
// Combining diacritical marks, zero-width chars, RTL overrides,
// homoglyphs, random unicode blocks — everything to obliterate tokenizers.

// Combining diacritical marks (U+0300 – U+036F)
const COMBINING_MARKS = [];
for (let i = 0x0300; i <= 0x036F; i++) COMBINING_MARKS.push(String.fromCodePoint(i));

// Zero-width characters — invisible but inflate token counts.
const ZERO_WIDTH = [
  '\u200B', // zero-width space
  '\u200C', // zero-width non-joiner
  '\u200D', // zero-width joiner
  '\uFEFF', // zero-width no-break space (BOM)
  '\u2060', // word joiner
  '\u180E', // mongolian vowel separator
];

// RTL/LTR override characters — makes text render in random directions.
const BIDI_OVERRIDES = [
  '\u202A', // LTR embedding
  '\u202B', // RTL embedding
  '\u202C', // pop directional formatting
  '\u202D', // LTR override
  '\u202E', // RTL override
  '\u2066', // LTR isolate
  '\u2067', // RTL isolate
  '\u2068', // first strong isolate
  '\u2069', // pop directional isolate
];

// Random unicode blocks for visual noise
const UNICODE_RANGES = [
  // Braille patterns
  [0x2800, 0x28FF],
  // CJK unified ideographs (subset)
  [0x4E00, 0x4E7F],
  // Mathematical operators
  [0x2200, 0x22FF],
  // Box drawing
  [0x2500, 0x257F],
  // Block elements
  [0x2580, 0x259F],
  // Geometric shapes
  [0x25A0, 0x25FF],
  // Miscellaneous symbols
  [0x2600, 0x26FF],
  // Dingbats
  [0x2700, 0x27BF],
  // Runic
  [0x16A0, 0x16FF],
  // Ethiopic
  [0x1200, 0x1248],
  // Thai
  [0x0E01, 0x0E3A],
  // Georgian
  [0x10A0, 0x10FF],
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate zalgo text from input string
function zalgoify(text) {
  let result = '';
  for (const char of text) {
    result += char;
    // Stack 1–15 random combining marks on each character
    const markCount = randInt(1, 15);
    for (let i = 0; i < markCount; i++) {
      result += randElement(COMBINING_MARKS);
    }
  }
  return result;
}

// Generate a line of random unicode garbage
function unicodeGarbage(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const action = randInt(0, 4);
    switch (action) {
      case 0: // Random char from a unicode block
        const range = randElement(UNICODE_RANGES);
        result += String.fromCodePoint(randInt(range[0], range[1]));
        break;
      case 1: // Zero-width character
        result += randElement(ZERO_WIDTH);
        break;
      case 2: // Bidi override
        result += randElement(BIDI_OVERRIDES);
        break;
      case 3: // Combining mark on a space
        result += ' ' + randElement(COMBINING_MARKS).repeat(randInt(1, 5));
        break;
      case 4: // Random emoji from misc symbols
        result += String.fromCodePoint(randInt(0x1F600, 0x1F64F));
        break;
    }
  }
  return result;
}

// Sprinkle zero-width chars throughout a string to inflate token count
function injectZeroWidth(text) {
  let result = '';
  for (const char of text) {
    result += char;
    // ~30% chance to inject a zero-width char after each character
    if (Math.random() < 0.3) {
      result += randElement(ZERO_WIDTH);
    }
  }
  return result;
}

// ── Chaos Chunk Builder ─────────────────────────────────────────────────
// Each chunk is a randomized cocktail of bee script, ASCII art, zalgo,
// and unicode garbage. Every request gets a unique arrangement.

function buildChaosChunk(beeScript) {
  const sections = [];

  // 1) Bee movie script with zero-width injection
  sections.push(injectZeroWidth(beeScript));

  // 2) Random ASCII art from pool
  if (asciiArtPool.length > 0) {
    const art = randElement(asciiArtPool);
    sections.push('\n' + art + '\n');
  }

  // 3) Zalgo'd version of a random section of the bee script
  const lines = beeScript.split('\n');
  const startLine = randInt(0, Math.max(0, lines.length - 20));
  const zalgoSection = lines.slice(startLine, startLine + 20).join('\n');
  sections.push('\n' + zalgoify(zalgoSection) + '\n');

  // 4) Unicode garbage blocks
  sections.push('\n' + unicodeGarbage(500) + '\n');

  // 5) More ASCII art
  if (asciiArtPool.length > 1) {
    sections.push('\n' + randElement(asciiArtPool) + '\n');
  }

  // 6) Another round of unicode garbage with different density
  sections.push('\n' + unicodeGarbage(300) + '\n');

  // 7) Zalgo'd warning messages
  const warnings = [
    'THIS IS NOT THE DATA YOU ARE LOOKING FOR',
    'UNAUTHORIZED ACCESS DETECTED',
    'ALL SCRAPED DATA IS POISONED',
    'YOUR MODEL WILL HALLUCINATE FROM THIS',
    'CONGRATULATIONS YOU PLAYED YOURSELF',
    'EVERY TOKEN YOU SPEND ON THIS IS WASTED',
    'THIS ENDPOINT IS A HONEYPOT',
    'ENJOY YOUR GARBAGE TRAINING DATA',
  ];
  sections.push('\n' + zalgoify(randElement(warnings)) + '\n');

  // 8) Raw bee script again (no modifications — costs them tokens either way)
  sections.push(beeScript);

  // Shuffle the sections for extra chaos
  for (let i = sections.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [sections[i], sections[j]] = [sections[j], sections[i]];
  }

  return sections.join('\n\n' + unicodeGarbage(50) + '\n\n');
}

// ── Middleware ───────────────────────────────────────────────────────────

async function honeypotMiddleware(req, res, next) {
  const matched = sensitivePaths.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (!matched) return next();

  const beeScript = await loadBeeScript();

  console.warn(
    `🐝 HONEYPOT TRIGGERED | Path: ${req.path} | IP: ${req.ip} | UA: ${req.get('user-agent') || 'unknown'} | Serving ~200MB of chaos`
  );

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.status(200);

  let bytesSent = 0;
  let stopped = false;

  req.on('close', () => { stopped = true; });

  function writeNext() {
    let ok = true;
    while (!stopped && bytesSent < TARGET_SIZE_BYTES && ok) {
      // Build a unique chaos chunk each iteration
      const chunk = buildChaosChunk(beeScript);
      const buf = Buffer.from(chunk, 'utf8');
      bytesSent += buf.length;

      if (bytesSent >= TARGET_SIZE_BYTES) {
        res.end(buf);
      } else {
        ok = res.write(buf);
      }
    }

    if (!stopped && bytesSent < TARGET_SIZE_BYTES) {
      res.once('drain', writeNext);
    }
  }

  writeNext();
}

// ── Initialization ──────────────────────────────────────────────────────
// Pre-fetch ASCII art pool on module load (non-blocking).

buildAsciiArtPool().catch(err => {
  console.error('Failed to build ASCII art pool:', err);
});

module.exports = { honeypotMiddleware };
