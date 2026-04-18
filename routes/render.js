// Render integration routes: deployments and previews
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireBotOwner } = require('../security');

// ── Get Active Previews ─────────────────────────────────────────────────

router.get('/api/render/previews', requireBotOwner, async (req, res) => {
    try {
        const db = getDb();
        const [rows] = await db.execute(
            'SELECT * FROM site_previews ORDER BY created_at DESC LIMIT 50'
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch previews error:', error);
        res.status(500).json({ error: 'Failed to fetch previews' });
    }
});

// ── Deactivate Preview ──────────────────────────────────────────────────

router.post('/api/render/previews/:id/deactivate', requireBotOwner, async (req, res) => {
    try {
        const db = getDb();
        await db.execute(
            'UPDATE site_previews SET status = "inactive" WHERE id = ?',
            [req.params.id]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error('Deactivate preview error:', error);
        res.status(500).json({ error: 'Failed to deactivate preview' });
    }
});

module.exports = router;
