const express = require('express');
const router = express.Router();
const Url = require('./Url');
const shortid = require('shortid');
const validUrl = require('valid-url');
const geoip = require('geoip-lite');

const isValidShortCode = (code) => /^[a-zA-Z0-9_-]{4,20}$/.test(code);

const generateUniqueShortCode = async () => {
    let code, isUnique = false, attempts = 0;
    while (!isUnique && attempts < 5) {
        code = shortid.generate();
        const existing = await Url.findOne({ shortCode: code });
        if (!existing) isUnique = true;
        attempts++;
    }
    if (!isUnique) throw new Error('Could not generate unique short code');
    return code;
};

router.post('/', async (req, res) => {
    try {
        const { url, validity = 30, shortcode } = req.body;

        if (!url || !validUrl.isWebUri(url)) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        if (isNaN(validity)) {
            return res.status(400).json({ error: 'The validity you have entered is not a number' });
        }
        if (validity <= 0) {
            return res.status(400).json({ error: 'The validity you have entered is negative' });
        }

        let shortCode;
        if (shortcode) {
            if (!isValidShortCode(shortcode)) {
                return res.status(400).json({ error: 'it should be 4 to 20 char and alumn' });
            }
            const existing = await Url.findOne({ shortCode: shortcode });
            if (existing) return res.status(409).json({ error: 'Shortcode already in use' });
            shortCode = shortcode;
        } else {
            shortCode = await generateUniqueShortCode();
        }

        const expiresAt = new Date(Date.now() + validity * 60000);
        const newUrl = new Url({ originalUrl: url, shortCode, expiresAt });
        await newUrl.save();

        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('host');
        res.status(201).json({
            shortlink: `${protocol}://${host}/${shortCode}`,
            expiry: expiresAt.toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Redirect route
router.get('/:shortCode', async (req, res) => {
    try {
        const shortCode = req.params.shortCode;
        const url = await Url.findOne({ shortCode });

        if (!url) return res.status(404).json({ error: 'Short URL not found' });
        if (new Date() > url.expiresAt) return res.status(410).json({ error: 'Short URL has expired' });

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const geo = geoip.lookup(ip) || {};

        url.clicks.push({
            ipAddress: ip,
            referrer: req.get('Referer') || 'direct',
            country: geo.country || 'Unknown',
            region: geo.region || 'Unknown'
        });
        await url.save();

        res.redirect(302, url.originalUrl);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stats route
router.get('/stats/:shortCode', async (req, res) => {
    try {
        const shortCode = req.params.shortCode;
        const url = await Url.findOne({ shortCode });

        if (!url) return res.status(404).json({ error: 'Short URL not found' });

        res.json({
            originalUrl: url.originalUrl,
            createdAt: url.createdAt,
            expiry: url.expiresAt,
            totalClicks: url.clicks.length,
            clicks: url.clicks.map(click => ({
                timestamp: click.timestamp,
                referrer: click.referrer,
                location: `${click.region}, ${click.country}`
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
