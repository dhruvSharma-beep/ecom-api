const app = require('./app');
const { testConnection } = require('./db');

const PORT = process.env.PORT || 5000;

async function start() {
  await testConnection();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
