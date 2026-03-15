const express = require('express');
const router = express.Router();

// Import Node.js database pool
const { getDb } = require('../db');

// GET /api/leaderboard/coins?limit=15&offset=0
router.get('/api/leaderboard/coins', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = parseInt(req.query.offset, 10) || 0;
    try {
        const db = getDb();
        // Query wallet leaderboard directly
        const [rows] = await db.execute(
            'SELECT user_id, wallet FROM users WHERE wallet > 0 ORDER BY wallet DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        // Map to expected format
        const entries = rows.map((row, idx) => ({
            user_id: row.user_id,
            username: `User#${row.user_id}`,
            value: row.wallet,
            rank: offset + idx + 1,
            extra_info: ''
        }));
        res.json({
            data: entries,
            unresolved: 0,
            total: entries.length
        });
    } catch (err) {
        console.error('[LEADERBOARD ERROR]', err);
        res.status(500).json({ error: 'Failed to load leaderboard', details: err.message });
    }
});

module.exports = router;
// GET /api/leaderboard/xp?limit=15&offset=0
router.get('/api/leaderboard/xp', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = parseInt(req.query.offset, 10) || 0;
    try {
        const db = getDb();
        // Query XP leaderboard directly
        const [rows] = await db.execute(
            'SELECT user_id, total_xp, level FROM user_xp WHERE total_xp > 0 ORDER BY total_xp DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        // Map to expected format
        const entries = rows.map((row, idx) => ({
            user_id: row.user_id,
            username: `User#${row.user_id}`,
            value: row.total_xp,
            rank: offset + idx + 1,
            extra_info: `Level ${row.level}`
        }));
        res.json({
            data: entries,
            unresolved: 0,
            total: entries.length
        });
    } catch (err) {
        console.error('[LEADERBOARD XP ERROR]', err);
        res.status(500).json({ error: 'Failed to load XP leaderboard', details: err.message });
    }
});
