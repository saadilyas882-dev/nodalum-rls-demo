require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/matters', require('./routes/matters'));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Nodalum RLS demo running on port ${PORT}`));
}

module.exports = app;
