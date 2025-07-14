const express = require('express');
const shorturl = require('./shortUrls');
const connectDB = require('./db');
const { loggingMiddleware } = require('./logging-middleware');
const app = express();
app.use(express.json());
app.use(loggingMiddleware);

connectDB();

app.use('/shorturls', shorturl);
app.use('/', shorturl);

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(8080, () => {
    console.log(`Server started at prot 8080`);
});
