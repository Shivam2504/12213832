const mongoose = require('mongoose');
const validUrl = require('valid-url');

const urlSchema = new mongoose.Schema({
    originalUrl: {
        type: String,
        required: true,
        validate: {
            validator: (value) => validUrl.isUri(value),
            message: 'Not a valid URL'
        }
    },
    shortCode: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },
    clicks: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        referrer: String,
        ipAddress: String,
        country: String,
        region: String
    }]
});

module.exports = mongoose.model('Url', urlSchema);
