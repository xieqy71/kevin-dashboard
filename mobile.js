const BACKEND_URL = 'http://localhost:3000';

let mobileData = {
    account: {
        douyin: { fans: '--', likes: '--', works: '--' },
        xiaohongshu: { fans: '--', likes: '--', works: '--' },
        bilibili: { fans: '--', likes: '--', works: '--' }
    },
    kpi: { totalViews: '--', totalLikes: '--', netFollowers: '--' },
    works: []
};

function formatNumber(num) {
    if (typeof num === 'string') return num;
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    return num.toLocaleString();
}

function showSection(sectionId) {
    document.querySelectorAll('.mobile-section').forEach(el => el.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (sectionId === 'mobile-home') {
        document.querySelector('.nav-item:first-child').classList.add('active');
    }
}

function toggleMobileLogin() {
    const isLoggedIn = localStorage.getItem('liangyu_logged_in') === 'true';
    if (isLoggedIn) {
        localStorage.removeItem('liangyu_logged_in');
        showSection('mobile-login');
    } else {
        showSection('mobile-login');
    }
}

function mobileLogin() {
    const username = document.getElementById('mobileUsername').value;
    const password = document.getElementById('mobilePassword').value;
    
    const users = JSON.parse(localStorage.getItem('liangyu_users') || '{}');
    if (users[username] && users[username] === password) {
        localStorage.setItem('liangyu_logged_in', 'true');
        localStorage.setItem('liangyu_username', username);
        showSection('mobile-home');
        loadMobileData();
    } else {
        alert('用户名或密码错误');
    }
}

function mobileRegister() {
    const username = document.getElementById('mobileUsername').value;
    const password = document.getElementById('mobilePassword').value;
    
    const users = JSON.parse(localStorage.getItem('liangyu_users') || '{}');
    if (users[username]) {
        alert('用户名已存在');
        return;
    }
    
    users[username] = password;
    localStorage.setItem('liangyu_users', JSON.stringify(users));
    alert('注册成功，请登录');
}

function backToHome() {
    showSection('mobile-home');
}

async function loadMobileData() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/all/data`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const { accounts, works } = result.data;
            
            if (accounts.douyin) {
                mobileData.account.douyin = {
                    fans: accounts.douyin.fans || '--',
                    likes: accounts.douyin.likes || '--',
                    works: accounts.douyin.works || '--'
                };
            }
            
            if (accounts.xiaohongshu) {
                mobileData.account.xiaohongshu = {
                    fans: accounts.xiaohongshu.fans || '--',
                    likes: accounts.xiaohongshu.likes || '--',
                    works: accounts.xiaohongshu.works || '--'
                };
            }
            
            if (accounts.bilibili) {
                mobileData.account.bilibili = {
                    fans: accounts.bilibili.fans || '--',
                    likes: accounts.bilibili.likes || '--',
                    works: accounts.bilibili.works || '--'
                };
            }
            
            mobileData.works = works.slice(0, 5);
        }
    } catch (error) {
        console.log('后端API不可用，使用本地数据:', error.message);
    }
    
    updateMobileUI();
}

function updateMobileUI() {
    document.getElementById('mTotalViews').textContent = formatNumber(mobileData.kpi.totalViews);
    document.getElementById('mTotalLikes').textContent = formatNumber(mobileData.kpi.totalLikes);
    document.getElementById('mNetFollowers').textContent = formatNumber(mobileData.kpi.netFollowers);
    
    document.getElementById('mDouyinFans').textContent = formatNumber(mobileData.account.douyin.fans);
    document.getElementById('mDouyinLikes').textContent = formatNumber(mobileData.account.douyin.likes);
    
    document.getElementById('mXiaohongshuFans').textContent = formatNumber(mobileData.account.xiaohongshu.fans);
    document.getElementById('mXiaohongshuLikes').textContent = formatNumber(mobileData.account.xiaohongshu.likes);
    
    document.getElementById('mBilibiliFans').textContent = formatNumber(mobileData.account.bilibili.fans);
    document.getElementById('mBilibiliLikes').textContent = formatNumber(mobileData.account.bilibili.likes);
    
    renderMobileWorks();
}

function renderMobileWorks() {
    const container = document.getElementById('mobileWorksList');
    if (!container) return;
    
    container.innerHTML = mobileData.works.map(item => `
        <div class="work-item">
            <div class="work-image">
                <i class="fas fa-play"></i>
            </div>
            <div class="work-info">
                <div class="work-title">${item.title}</div>
                <div class="work-stats">
                    <span>点赞 ${formatNumber(item.likes)}</span>
                    <span>播放 ${formatNumber(item.views)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showPlatformDetail(platform) {
    const data = mobileData.account[platform];
    const titles = { douyin: '抖音', xiaohongshu: '小红书', bilibili: 'B站' };
    
    document.getElementById('detailTitle').textContent = titles[platform];
    document.getElementById('dFans').textContent = formatNumber(data.fans);
    document.getElementById('dLikes').textContent = formatNumber(data.likes);
    document.getElementById('dWorks').textContent = formatNumber(data.works);
    
    const platformWorks = mobileData.works.filter(w => w.platform === platform);
    const detailContainer = document.getElementById('detailWorksList');
    detailContainer.innerHTML = platformWorks.map(item => `
        <div class="work-item">
            <div class="work-image">
                <i class="fas fa-play"></i>
            </div>
            <div class="work-info">
                <div class="work-title">${item.title}</div>
                <div class="work-stats">
                    <span>点赞 ${formatNumber(item.likes)}</span>
                    <span>播放 ${formatNumber(item.views)}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    showSection('mobile-platform-detail');
}

function refreshMobileData() {
    loadMobileData();
    alert('数据已刷新');
}

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('liangyu_logged_in') === 'true';
    if (isLoggedIn) {
        showSection('mobile-home');
        loadMobileData();
    } else {
        showSection('mobile-login');
    }
});