const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/urlshortener', {
            useNewUrlParser: true,
        });
        console.log('MongoDB connected');
    } catch (err) {
        console.error('connection error:', err.message);
    }
};

module.exports = connectDB;
