const express = require('express');
const router = express.Router();
const Url = require('./Url');
const validUrl = require('valid-url');
const shortid = require('shortid');

function isValidCode(code) {
    return /^[a-z0-9_-]{4,20}$/i.test(code);
}

async function createUniqueCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = shortid.generate();
        const exists = await Url.findOne({ shortCode: code });
        if (!exists) return code;
    }
    throw new Error('Failed to generate unique code');
}

router.post('/', async (req, res) => {
    try {
        const { url, validity = 30, shortcode } = req.body;

        if (!validUrl.isWebUri(url)) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        if (isNaN(validity) || validity <= 0) {
            return res.status(400).json({ error: 'Invalid validity period' });
        }

        let finalCode;
        if (shortcode) {
            if (!isValidCode(shortcode)) {
                return res.status(400).json({ error: 'Shortcode must be 4-20 alphanumeric characters' });
            }
            
            if (await Url.findOne({ shortCode: shortcode })) {
                return res.status(409).json({ error: 'Shortcode already in use' });
            }
            finalCode = shortcode;
        } else {
            finalCode = await createUniqueCode();
        }
        const expiresAt = new Date(Date.now() + validity * 60000);
        const newUrl = new Url({ 
            originalUrl: url, 
            shortCode: finalCode, 
            expiresAt 
        });
        
        await newUrl.save();

        const host = req.get('host');
        res.status(201).json({
            shortlink: `${req.protocol}://${host}/${finalCode}`,
            expiry: expiresAt.toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:code', async (req, res) => {
    try {
        const url = await Url.findOne({ shortCode: req.params.code });
        
        if (!url) return res.status(404).json({ error: 'URL not found' });
        if (new Date() > url.expiresAt) return res.status(410).json({ error: 'Link expired' });
        url.clicks.push({
            ipAddress: req.ip,
            referrer: req.get('Referer') || 'direct'
        });
        
        await url.save();
        res.redirect(url.originalUrl);
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/shorturls/:code', async (req, res) => {
    try {
        const url = await Url.findOne({ shortCode: req.params.code });
        if (!url) return res.status(404).json({ error: 'URL not found' });

        res.json({
            originalUrl: url.originalUrl,
            createdAt: url.createdAt,
            expiry: url.expiresAt,
            totalClicks: url.clicks.length,
            clicks: url.clicks.map(click => ({
                time: click.timestamp,
                source: click.referrer,
                location: click.location
            }))
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;