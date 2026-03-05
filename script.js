// ========================================
// SYNQLESS VIRAL WAITLIST
// Complete referral system with Google Sheets backend
// ========================================

// Configuration
const CONFIG = {
    // IMPORTANT: Replace with your Web App URL (ends with /exec, NOT a library URL)
    // To get this: Deploy → New deployment → Web app → Copy URL
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzDzp-57XVB4YU5DwMyKHOWGHCMKX2O_DuHz2xIlAF8shBXZfMSNxtCNyujrAw5Bv26/exec',
    REFERRAL_REWARDS: [
        { referrals: 3, name: 'Priority Access', icon: '🥉' },
        { referrals: 5, name: 'Skip the Line', icon: '🥈' },
        { referrals: 10, name: 'Lifetime Free', icon: '🥇' },
        { referrals: 25, name: 'Founder Status', icon: '💎' }
    ],
    POINTS_PER_REFERRAL: 1
};

// State Management
const state = {
    currentUser: null,
    totalWaitlist: 0,
    referrals: 0,
    referralCode: null,
    position: null
};

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Load user data from localStorage
    loadUserData();
    
    // Check for referral code in URL
    checkReferralCode();
    
    // Initialize form handlers
    initializeForm();
    
    // Load stats and leaderboard from backend
    await Promise.all([
        loadStats(),
        loadLeaderboard()
    ]);
    
    // Animate counters
    animateCounters();
    
    // Show appropriate page based on user state
    determineInitialPage();
}

// ========================================
// BACKEND API CALLS
// ========================================

/**
 * Make API call to Google Apps Script
 * Uses GET requests with URL parameters to avoid CORS preflight issues
 */
async function apiCall(action, data = {}) {
    try {
        const url = new URL(CONFIG.GOOGLE_SCRIPT_URL);
        
        // Add action parameter
        url.searchParams.append('action', action);
        
        // Add all data as URL parameters (GET request)
        Object.keys(data).forEach(key => {
            const value = data[key];
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('API call failed:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Load stats from backend
 */
async function loadStats() {
    try {
        const result = await apiCall('getStats');
        if (result.success && result.stats) {
            state.totalWaitlist = result.stats.totalUsers || 0;
            localStorage.setItem('synqless_total_count', state.totalWaitlist);
            updateCounterDisplay();
        }
    } catch (error) {
        console.warn('Could not load stats from backend, using local data');
        // Use local data if backend is unavailable
        const savedCount = localStorage.getItem('synqless_total_count');
        if (savedCount) {
            state.totalWaitlist = parseInt(savedCount);
            updateCounterDisplay();
        }
    }
}

/**
 * Load leaderboard from backend
 */
async function loadLeaderboard() {
    try {
        const result = await apiCall('getLeaderboard', { limit: 5 });
        if (result.success && result.leaderboard) {
            renderLeaderboard(result.leaderboard);
        }
    } catch (error) {
        console.warn('Could not load leaderboard from backend');
        // Keep existing leaderboard or show empty state
        const container = document.getElementById('leaderboard-list');
        if (container && container.children.length === 0) {
            container.innerHTML = '<div class="leaderboard-empty">Leaderboard loading...</div>';
        }
    }
}

/**
 * Register user with backend
 */
async function registerUser(userData) {
    return await apiCall('register', userData);
}

/**
 * Track referral click
 */
async function trackReferralClick(refCode) {
    return await apiCall('trackReferralClick', { 
        referralCode: refCode,
        clickedBy: getDeviceId()
    });
}

/**
 * Get user data from backend
 */
async function getUserFromBackend(email) {
    return await apiCall('getUser', { email: email });
}

// ========================================
// NAVIGATION
// ========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showHero() {
    showPage('hero-page');
}

function showSignup() {
    showPage('signup-page');
}

function showDashboard() {
    showPage('dashboard-page');
    updateDashboard();
}

function determineInitialPage() {
    // Don't override if already showing signup (from referral link)
    const signupPage = document.getElementById('signup-page');
    if (signupPage && signupPage.classList.contains('active')) {
        return;
    }
    
    if (state.currentUser) {
        showDashboard();
    } else {
        showHero();
    }
}

// ========================================
// USER DATA MANAGEMENT
// ========================================
function loadUserData() {
    const userData = localStorage.getItem('synqless_user');
    if (userData) {
        state.currentUser = JSON.parse(userData);
        state.referrals = state.currentUser.referralsCount || 0;
        state.referralCode = state.currentUser.referralCode;
        state.position = state.currentUser.position;
    }
    
    const savedCount = localStorage.getItem('synqless_total_count');
    if (savedCount) {
        state.totalWaitlist = parseInt(savedCount);
    }
}

function saveUserData(userData) {
    state.currentUser = userData;
    state.referrals = userData.referralsCount || 0;
    state.referralCode = userData.referralCode;
    state.position = userData.position;
    localStorage.setItem('synqless_user', JSON.stringify(userData));
}

function getDeviceId() {
    let deviceId = localStorage.getItem('synqless_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('synqless_device_id', deviceId);
    }
    return deviceId;
}

// ========================================
// REFERRAL CODE HANDLING
// ========================================
function checkReferralCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        localStorage.setItem('synqless_referred_by', refCode);
        trackReferralClick(refCode);
        
        if (!state.currentUser) {
            showSignup();
        }
    }
}

function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function getReferralLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?ref=${state.referralCode}`;
}

// ========================================
// FORM HANDLING
// ========================================
function initializeForm() {
    const form = document.getElementById('waitlist-form');
    if (!form) return;
    
    form.addEventListener('submit', handleFormSubmit);
    
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearError(input));
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('.submit-btn');
    
    if (!validateForm(form)) {
        return;
    }
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            companySize: document.getElementById('companySize').value,
            companyName: document.getElementById('companyName').value.trim(),
            referredBy: localStorage.getItem('synqless_referred_by') || null,
            ipAddress: await getIPAddress().catch(() => 'unknown')
        };
        
        // Register with backend
        const result = await registerUser(formData);
        
        if (!result.success) {
            if (result.message && result.message.includes('already on the waitlist')) {
                showError(document.getElementById('email'), 'This email is already on the waitlist');
                if (result.user) {
                    saveUserData(result.user);
                    setTimeout(() => showDashboard(), 1000);
                }
            } else {
                alert(result.message || 'Registration failed. Please try again.');
            }
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            return;
        }
        
        // Save user data
        saveUserData(result.user);
        
        // Update stats
        state.totalWaitlist = result.totalUsers;
        localStorage.setItem('synqless_total_count', state.totalWaitlist);
        updateCounterDisplay();
        
        // Show dashboard
        showDashboard();
        form.reset();
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Something went wrong. Please try again.');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

function validateForm(form) {
    let isValid = true;
    const fields = form.querySelectorAll('input[required], select[required]');
    
    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

function validateField(field) {
    clearError(field);
    
    const value = field.value.trim();
    
    if (!value) {
        showError(field, 'This field is required');
        return false;
    }
    
    if (field.type === 'email' && !isValidEmail(value)) {
        showError(field, 'Please enter a valid email address');
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(field, message) {
    field.classList.add('error');
    const errorEl = field.parentElement.querySelector('.error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
}

function clearError(field) {
    field.classList.remove('error');
    const errorEl = field.parentElement.querySelector('.error-message');
    if (errorEl) {
        errorEl.classList.remove('visible');
    }
}

function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// DASHBOARD
// ========================================
function updateDashboard() {
    if (!state.currentUser) return;
    
    // Update user info
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const positionEl = document.getElementById('user-position');
    
    if (userNameEl) userNameEl.textContent = state.currentUser.fullName;
    if (userEmailEl) userEmailEl.textContent = state.currentUser.email;
    if (positionEl) positionEl.textContent = '#' + state.currentUser.position;
    
    // Update referral code display
    const refCodeEl = document.getElementById('referral-code');
    if (refCodeEl) refCodeEl.textContent = state.referralCode;
    
    // Update referral link
    const refLinkEl = document.getElementById('referral-link');
    if (refLinkEl) refLinkEl.value = getReferralLink();
    
    // Update progress
    updateReferralProgress();
    
    // Update stats
    updateDashboardStats();
}

function updateReferralProgress() {
    const currentCount = state.referrals || 0;
    
    // Find next milestone
    let nextMilestone = CONFIG.REFERRAL_REWARDS[0];
    let previousMilestone = { referrals: 0 };
    
    for (const reward of CONFIG.REFERRAL_REWARDS) {
        if (currentCount >= reward.referrals) {
            previousMilestone = reward;
        } else {
            nextMilestone = reward;
            break;
        }
    }
    
    // Calculate progress
    const range = nextMilestone.referrals - previousMilestone.referrals;
    const progress = Math.min(100, ((currentCount - previousMilestone.referrals) / range) * 100);
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    
    // Update milestone display
    const currentCountEl = document.getElementById('current-referrals');
    const nextMilestoneEl = document.getElementById('next-milestone');
    const rewardNameEl = document.getElementById('next-reward-name');
    
    if (currentCountEl) currentCountEl.textContent = currentCount;
    if (nextMilestoneEl) nextMilestoneEl.textContent = nextMilestone.referrals;
    if (rewardNameEl) {
        rewardNameEl.textContent = `${nextMilestone.icon} ${nextMilestone.name}`;
    }
}

function updateDashboardStats() {
    const waitlistCountEl = document.getElementById('dashboard-waitlist-count');
    const referralCountEl = document.getElementById('dashboard-referral-count');
    const pointsCountEl = document.getElementById('dashboard-points-count');
    
    if (waitlistCountEl) {
        waitlistCountEl.textContent = state.totalWaitlist.toLocaleString();
    }
    if (referralCountEl) {
        referralCountEl.textContent = state.referrals;
    }
    if (pointsCountEl) {
        pointsCountEl.textContent = state.referrals * CONFIG.POINTS_PER_REFERRAL;
    }
}

// ========================================
// LEADERBOARD
// ========================================
function initializeLeaderboard() {
    // Leaderboard is loaded from backend in initializeApp
}

function renderLeaderboard(leaderboardData) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!leaderboardData || leaderboardData.length === 0) {
        container.innerHTML = '<div class="leaderboard-empty">Be the first to refer friends!</div>';
        return;
    }
    
    leaderboardData.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `<span class="rank-number">${index + 1}</span>`;
        
        item.innerHTML = `
            <div class="leaderboard-rank ${rankClass}">${rankIcon}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${escapeHtml(user.fullName || 'Anonymous')}</div>
            </div>
            <div class="leaderboard-referrals">
                <span class="referral-count">${user.referralsCount}</span>
                <span class="referral-label">referrals</span>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// COUNTER ANIMATION
// ========================================
function animateCounters() {
    const counter = document.getElementById('total-waitlist-count');
    if (!counter) return;
    
    const target = state.totalWaitlist;
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (target - start) * easeOutQuart);
        
        counter.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateCounterDisplay() {
    const counter = document.getElementById('total-waitlist-count');
    if (counter) {
        counter.textContent = state.totalWaitlist.toLocaleString();
    }
}

// ========================================
// SOCIAL SHARING
// ========================================
function shareOnTwitter() {
    const text = `I just joined the waitlist for Synqless! 🚀\n\nUse my referral code to skip the line: ${state.referralCode}\n\n`;
    const url = getReferralLink();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function shareOnLinkedIn() {
    const url = getReferralLink();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
}

function shareViaEmail() {
    const subject = 'Join me on the Synqless waitlist!';
    const body = `Hey!\n\nI just joined the waitlist for Synqless - an amazing new tool.\n\nUse my referral link to sign up and help me move up the list:\n${getReferralLink()}\n\nMy referral code: ${state.referralCode}\n\nThanks!`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function copyReferralLink() {
    const input = document.getElementById('referral-link');
    if (!input) return;
    
    input.select();
    input.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.querySelector('.copy-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        }
    });
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function logout() {
    localStorage.removeItem('synqless_user');
    localStorage.removeItem('synqless_referred_by');
    state.currentUser = null;
    state.referrals = 0;
    state.referralCode = null;
    state.position = null;
    showHero();
}

// Expose functions to global scope for HTML event handlers
window.showHero = showHero;
window.showSignup = showSignup;
window.shareOnTwitter = shareOnTwitter;
window.shareOnLinkedIn = shareOnLinkedIn;
window.shareViaEmail = shareViaEmail;
window.copyReferralLink = copyReferralLink;
window.logout = logout;
