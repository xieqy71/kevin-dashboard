const BACKEND_URL = 'http://localhost:3000';

const mockData = {
    account: {
        douyin: { fans: 3280, following: 124, likes: 45680, works: 89, todayViews: 1256 },
        xiaohongshu: { fans: 1850, following: 86, likes: 23450, works: 156, todayViews: 890 },
        bilibili: { fans: 560, following: 45, likes: 8920, works: 32, todayViews: 320 },
        kuaishou: { fans: 1200, following: 67, likes: 15680, works: 67, todayViews: 560 },
        wechat: { fans: 890, following: 34, likes: 7890, works: 45, todayViews: 234 }
    },
    kpi: { totalViews: '125.6万', totalLikes: 101620, totalComments: '3.2万', totalShares: '1.8万', netFollowers: 7780 },
    trendData: {
        dates: ['7/19', '7/20', '7/21', '7/22', '7/23', '7/24', '7/25'],
        douyin: [12500, 15600, 13200, 18900, 16700, 21000, 18500],
        xiaohongshu: [8900, 9800, 11200, 10500, 12300, 13800, 11500],
        bilibili: [3200, 4500, 3800, 5200, 4800, 6100, 5500],
        kuaishou: [5600, 6200, 7100, 6800, 7500, 8200, 7800],
        wechat: [2300, 2800, 3100, 2900, 3400, 3800, 3200]
    },
    pieData: {
        views: [
            { name: '抖音', value: 45680 },
            { name: '小红书', value: 23450 },
            { name: 'B站', value: 8920 },
            { name: '快手', value: 15680 },
            { name: '微信视频号', value: 7890 }
        ],
        likes: [
            { name: '抖音', value: 45680 },
            { name: '小红书', value: 23450 },
            { name: 'B站', value: 8920 },
            { name: '快手', value: 15680 },
            { name: '微信视频号', value: 7890 }
        ]
    },
    works: [
        { id: 1, rank: 1, platform: 'douyin', title: '2024世界杯精彩进球集锦', publish_time: '2024-07-24', views: '12.5万', likes: 8920, favorites: 2340, comments: '890', shares: 560, rate: '7.2%' },
        { id: 2, rank: 2, platform: 'xiaohongshu', title: '足球训练日常分享', publish_time: '2024-07-23', views: '8.2万', likes: 5680, favorites: 1890, comments: '620', shares: 320, rate: '6.9%' },
        { id: 3, rank: 3, platform: 'bilibili', title: '足球战术分析：传控打法详解', publish_time: '2024-07-22', views: '5.6万', likes: 3450, favorites: 1230, comments: '450', shares: 280, rate: '6.1%' },
        { id: 4, rank: 4, platform: 'kuaishou', title: '街头足球技巧教学', publish_time: '2024-07-24', views: '6.8万', likes: 4230, favorites: 1560, comments: '510', shares: 380, rate: '6.2%' },
        { id: 5, rank: 5, platform: 'wechat', title: '青少年足球培训心得', publish_time: '2024-07-25', views: '3.2万', likes: 2150, favorites: 890, comments: '230', shares: 150, rate: '6.7%' }
    ]
};

let realData = JSON.parse(JSON.stringify(mockData));
let trendChart, pieChart;

function formatNumber(num) {
    if (typeof num === 'string') {
        num = parseChineseNumber(num);
    }
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    return num.toLocaleString();
}

function parseChineseNumber(str) {
    str = str.replace(/[+\s]/g, '');
    var match = str.match(/^(\d+(?:\.\d+)?)(千|万|亿)?$/);
    if (match) {
        var num = parseFloat(match[1]);
        var unit = match[2];
        if (unit === '千') return num * 1000;
        if (unit === '万') return num * 10000;
        if (unit === '亿') return num * 100000000;
        return num;
    }
    return parseInt(str) || str;
}

let currentWechatState = '';
let currentBindPlatform = '';
let currentBindScene = '';
let scanPollingInterval = null;

function switchAuthTab(tab) {
    var buttons = document.querySelectorAll('.login-tabs .tab-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    var activeBtn = document.querySelector('.login-tabs .tab-btn[onclick="switchAuthTab(\'' + tab + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    
    document.getElementById('auth-sms').style.display = tab === 'sms' ? 'block' : 'none';
    document.getElementById('auth-wechat').style.display = tab === 'wechat' ? 'block' : 'none';
    
    if (tab === 'wechat') {
        refreshWechatQrcode();
    }
}

function validatePhone(input) {
    input.value = input.value.replace(/[^\d]/g, '').slice(0, 11);
}

function sendVerificationCode() {
    var phone = document.getElementById('phoneInput').value;
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        alert('请输入正确的手机号码');
        return;
    }
    
    fetch(BACKEND_URL + '/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            var btn = document.getElementById('sendCodeBtn');
            btn.disabled = true;
            btn.textContent = '60秒后重发';
            
            var countdown = 60;
            var timer = setInterval(function() {
                countdown--;
                btn.textContent = countdown + '秒后重发';
                if (countdown <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = '发送验证码';
                }
            }, 1000);
        } else {
            alert(result.error || '发送失败');
        }
    })
    .catch(function(error) {
        alert('发送失败，请检查后端服务是否启动');
    });
}

function verifyCode() {
    var phone = document.getElementById('phoneInput').value;
    var code = document.getElementById('codeInput').value;
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        alert('请输入正确的手机号码');
        return;
    }
    
    if (!/^\d{6}$/.test(code)) {
        alert('请输入6位验证码');
        return;
    }
    
    fetch(BACKEND_URL + '/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, code: code })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            localStorage.setItem('liangyu_token', result.data.token);
            localStorage.setItem('liangyu_username', result.data.user.nickname || '用户');
            
            var userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = result.data.user.nickname || '用户';
            }
            
            router.navigate('bind');
        } else {
            alert(result.error || '登录失败');
        }
    })
    .catch(function(error) {
        alert('登录失败，请检查后端服务是否启动: ' + error.message);
    });
}

function refreshWechatQrcode() {
    fetch(BACKEND_URL + '/api/auth/wechat/qrcode')
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success && result.data) {
            currentWechatState = result.data.state;
            var qrcodeEl = document.getElementById('wechatQrcode');
            if (qrcodeEl) {
                qrcodeEl.src = result.data.qrcodeDataUrl;
            }
        }
    })
    .catch(function(error) {
        console.error('获取二维码失败:', error);
    });
}

function mockWechatLogin() {
    if (!currentWechatState) {
        alert('请先获取二维码');
        return;
    }
    
    fetch(BACKEND_URL + '/api/auth/wechat/mock-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: currentWechatState })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            localStorage.setItem('liangyu_token', result.data.token);
            localStorage.setItem('liangyu_username', result.data.user.nickname || '微信用户');
            
            var userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = result.data.user.nickname || '微信用户';
            }
            
            router.navigate('bind');
        } else {
            alert(result.error || '微信登录失败');
        }
    })
    .catch(function(error) {
        alert('微信登录失败，请检查后端服务是否启动');
    });
}

function logout() {
    localStorage.removeItem('liangyu_token');
    localStorage.removeItem('liangyu_username');
    router.navigate('login');
}

function openBindModal(platform) {
    currentBindPlatform = platform;
    var titles = { douyin: '绑定抖音', xiaohongshu: '绑定小红书', bilibili: '绑定B站' };
    var modalTitleEl = document.getElementById('bindModalTitle');
    if (modalTitleEl) {
        modalTitleEl.textContent = titles[platform];
    }
    
    var modal = document.getElementById('bindModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    
    switchBindTab('scan');
    refreshBindQrcode();
}

function closeBindModal() {
    var modal = document.getElementById('bindModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (scanPollingInterval) {
        clearInterval(scanPollingInterval);
        scanPollingInterval = null;
    }
    
    currentBindPlatform = '';
    currentBindScene = '';
}

function switchBindTab(tab) {
    var buttons = document.querySelectorAll('.bind-tabs .tab-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    var tabs = document.querySelectorAll('.bind-tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].style.display = 'none';
    }
    
    var activeBtn = document.querySelector('.bind-tabs .tab-btn[onclick="switchBindTab(\'' + tab + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    
    var activeTab = document.getElementById('bind-tab-' + tab);
    if (activeTab) activeTab.style.display = 'block';
    
    if (tab === 'scan') {
        refreshBindQrcode();
    }
}

function refreshBindQrcode() {
    if (!currentBindPlatform) return;
    
    var token = localStorage.getItem('liangyu_token');
    
    fetch(BACKEND_URL + '/api/auth/platform/bind/qrcode', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ platform: currentBindPlatform })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success && result.data) {
            currentBindScene = result.data.scene;
            
            var qrcodeEl = document.getElementById('bindQrcode');
            if (qrcodeEl) {
                qrcodeEl.src = result.data.qrcodeDataUrl;
            }
            
            var statusEl = document.getElementById('scanStatus');
            if (statusEl) {
                statusEl.textContent = '请使用手机扫码绑定';
            }
            
            var authLinkEl = document.getElementById('authLink');
            if (authLinkEl && result.data.authUrl) {
                authLinkEl.href = result.data.authUrl;
            }
            
            startScanPolling();
        }
    })
    .catch(function(error) {
        console.error('获取绑定二维码失败:', error);
    });
}

function startScanPolling() {
    if (scanPollingInterval) {
        clearInterval(scanPollingInterval);
    }
    
    scanPollingInterval = setInterval(function() {
        if (!currentBindScene) {
            clearInterval(scanPollingInterval);
            scanPollingInterval = null;
            return;
        }
        
        fetch(BACKEND_URL + '/api/auth/platform/bind/status/' + currentBindScene)
        .then(function(response) {
            return response.json();
        })
        .then(function(result) {
            if (result.success && result.data) {
                var status = result.data.status;
                var statusEl = document.getElementById('scanStatus');
                
                if (status === 'scanned') {
                    if (statusEl) {
                        statusEl.textContent = '绑定成功！';
                    }
                    
                    clearInterval(scanPollingInterval);
                    scanPollingInterval = null;
                    
                    updatePlatformConnection(currentBindPlatform, 'connected');
                    
                    setTimeout(function() {
                        closeBindModal();
                        alert('绑定成功！');
                    }, 1500);
                } else if (status === 'expired') {
                    if (statusEl) {
                        statusEl.textContent = '二维码已过期，请刷新';
                    }
                    clearInterval(scanPollingInterval);
                    scanPollingInterval = null;
                }
            }
        })
        .catch(function(error) {
            console.error('轮询扫码状态失败:', error);
        });
    }, 2000);
}

function mockScanBind() {
    if (!currentBindScene) {
        alert('请先获取二维码');
        return;
    }
    
    fetch(BACKEND_URL + '/api/auth/platform/bind/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: currentBindScene })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            var statusEl = document.getElementById('scanStatus');
            if (statusEl) {
                statusEl.textContent = '绑定成功！';
            }
            
            if (scanPollingInterval) {
                clearInterval(scanPollingInterval);
                scanPollingInterval = null;
            }
            
            updatePlatformConnection(currentBindPlatform, 'connected');
            
            setTimeout(function() {
                closeBindModal();
                alert('绑定成功！');
            }, 1500);
        } else {
            alert(result.error || '绑定失败');
        }
    })
    .catch(function(error) {
        alert('绑定失败，请检查后端服务');
    });
}

function authPlatform(platform) {
    var token = localStorage.getItem('liangyu_token');
    fetch(BACKEND_URL + '/api/' + platform + '/auth-url', {
        headers: { Authorization: 'Bearer ' + token }
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.url) {
            window.open(data.url, '_blank');
        } else if (data.error) {
            alert('授权配置未完成：' + data.error);
        } else {
            alert('获取授权链接失败');
        }
    })
    .catch(function(error) {
        alert('授权服务暂时不可用，请检查后端服务是否启动');
    });
}

var currentImportPlatform = '';

function openImportModal(platform) {
    currentImportPlatform = platform;
    var titles = { douyin: '抖音数据导入', xiaohongshu: '小红书数据导入', bilibili: 'B站数据导入' };
    document.getElementById('importModalTitle').textContent = titles[platform];
    document.getElementById('formPlatform').value = platform;
    document.getElementById('importModal').style.display = 'flex';
}

function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
}

function switchImportTab(tab) {
    var buttons = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    var tabs = document.querySelectorAll('.tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].style.display = 'none';
    }
    
    var activeBtn = document.querySelector('button[onclick="switchImportTab(\'' + tab + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    var activeTab = document.getElementById('tab-' + tab);
    if (activeTab) activeTab.style.display = 'block';
}

function uploadFile() {
    var fileInput = document.getElementById('importFileInput');
    var file = fileInput.files[0];
    var token = localStorage.getItem('liangyu_token');
    
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    var formData = new FormData();
    formData.append('file', file);
    formData.append('platform', currentImportPlatform);
    
    fetch(BACKEND_URL + '/api/import/file', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            alert('数据导入成功');
            closeImportModal();
            fileInput.value = '';
            updatePlatformConnection(currentImportPlatform, 'connected');
        } else {
            alert('导入失败：' + result.error);
        }
    })
    .catch(function(error) {
        alert('上传失败，请检查后端服务');
    });
}

function submitFormData() {
    var platform = document.getElementById('formPlatform').value;
    var name = document.getElementById('formName').value;
    var fans = document.getElementById('formFans').value;
    var likes = document.getElementById('formLikes').value;
    var works = document.getElementById('formWorks').value;
    var worksData = document.getElementById('formWorksData').value;
    var token = localStorage.getItem('liangyu_token');
    
    var worksArray = [];
    if (worksData) {
        var lines = worksData.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line) {
                var parts = line.split('|');
                if (parts.length >= 2) {
                    worksArray.push({
                        title: parts[0],
                        views: parts[1] || '--',
                        likes: parts[2] || 0,
                        comments: parts[3] || '--'
                    });
                }
            }
        }
    }
    
    fetch(BACKEND_URL + '/api/import/json', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
            platform: platform,
            data: {
                account: { name: name, fans: fans, likes: likes, works: parseInt(works) || 0 },
                works: worksArray
            }
        })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(result) {
        if (result.success) {
            alert('数据导入成功');
            closeImportModal();
            
            document.getElementById('formName').value = '';
            document.getElementById('formFans').value = '';
            document.getElementById('formLikes').value = '';
            document.getElementById('formWorks').value = '';
            document.getElementById('formWorksData').value = '';
            
            updatePlatformConnection(platform, 'connected');
        } else {
            alert('导入失败：' + result.error);
        }
    })
    .catch(function(error) {
        alert('提交失败，请检查后端服务');
    });
}

function updatePlatformConnection(platform, status) {
    var token = localStorage.getItem('liangyu_token');
    fetch(BACKEND_URL + '/api/platform-connections/' + platform, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ status: status })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function() {
        var el = document.getElementById('status-' + platform);
        if (el) {
            el.textContent = status === 'connected' ? '已绑定' : '未绑定';
            el.className = 'status-badge ' + status;
        }
    })
    .catch(function(error) {
        console.log('更新平台连接状态失败:', error.message);
    });
}

function fetchAllPlatformData() {
    // 纯静态模式，直接使用 mockData
    return Promise.resolve({
        success: true,
        data: {
            accounts: {
                douyin: realData.account.douyin,
                xiaohongshu: realData.account.xiaohongshu,
                bilibili: realData.account.bilibili,
                kuaishou: realData.account.kuaishou,
                wechat: realData.account.wechat
            },
            works: realData.works.map(function(w, i) {
                return {
                    id: w.id,
                    platform: w.platform,
                    title: w.title,
                    publish_time: w.publish_time,
                    views: w.views,
                    likes: w.likes,
                    favorites: w.favorites || 0,
                    comments: w.comments,
                    shares: w.shares || 0,
                    rate: w.rate
                };
            })
        }
    });
}

function loadPlatformConnections() {
    // 纯静态模式，模拟平台连接状态
    var platforms = ['douyin', 'xiaohongshu', 'bilibili', 'kuaishou', 'wechat'];
    platforms.forEach(function(p) {
        var el = document.getElementById('status-' + p);
        if (el) {
            el.textContent = '已绑定';
            el.className = 'status-badge connected';
        }
    });
}

function loadAccountData() {
    fetchAllPlatformData()
    .then(function() {
        loadFromLocalStorage();
        updateDashboard();
        updateAccountStats();
        renderQuickWorks();
        setTimeout(function() {
            initCharts();
        }, 200);
    })
    .catch(function(error) {
        console.error('Failed to load account data:', error);
        // 即使失败也尝试渲染模拟数据
        updateDashboard();
        updateAccountStats();
        renderQuickWorks();
        setTimeout(function() {
            initCharts();
        }, 200);
    });
}

function updateDashboard() {
    var totalViews = document.getElementById('totalViews');
    if (totalViews) totalViews.textContent = formatNumber(realData.kpi.totalViews);
    var totalLikes = document.getElementById('totalLikes');
    if (totalLikes) totalLikes.textContent = formatNumber(realData.kpi.totalLikes);
    var totalComments = document.getElementById('totalComments');
    if (totalComments) totalComments.textContent = formatNumber(realData.kpi.totalComments);
    var totalShares = document.getElementById('totalShares');
    if (totalShares) totalShares.textContent = formatNumber(realData.kpi.totalShares);
    var netFollowers = document.getElementById('netFollowers');
    if (netFollowers) netFollowers.textContent = formatNumber(realData.kpi.netFollowers);
}

function updateAccountStats() {
    var platforms = Object.keys(realData.account);
    for (var i = 0; i < platforms.length; i++) {
        var platform = platforms[i];
        var data = realData.account[platform];
        var fansEl = document.getElementById(platform + '-fans');
        if (fansEl) fansEl.textContent = formatNumber(data.fans);
        var likesEl = document.getElementById(platform + '-likes');
        if (likesEl) likesEl.textContent = formatNumber(data.likes);
        var worksEl = document.getElementById(platform + '-works');
        if (worksEl) worksEl.textContent = formatNumber(data.works);
    }
}

function renderQuickWorks() {
    var container = document.getElementById('quickWorksList');
    if (!container) return;
    
    var works = realData.works.slice(0, 5);
    var html = '';
    for (var i = 0; i < works.length; i++) {
        var item = works[i];
        html += '<div class="work-item">' +
            '<div class="work-card-image"><i class="fas fa-play play-icon"></i></div>' +
            '<div class="work-title">' + item.title + '</div>' +
            '<div class="work-stats"><span>点赞: ' + formatNumber(item.likes) + '</span></div>' +
            '</div>';
    }
    container.innerHTML = html;
}

function initCharts() {
    if (trendChart) trendChart.dispose();
    if (pieChart) pieChart.dispose();
    
    var trendEl = document.getElementById('trendChart');
    var pieEl = document.getElementById('pieChart');
    
    var platformColors = {
        douyin: '#5B8AB8',
        xiaohongshu: '#C4849E',
        bilibili: '#9B7BB8',
        kuaishou: '#D4A56A',
        wechat: '#5BA87C'
    };
    
    var platformNames = {
        douyin: '抖音',
        xiaohongshu: '小红书',
        bilibili: 'B站',
        kuaishou: '快手',
        wechat: '微信视频号'
    };
    
    var series = [];
    for (var p in platformNames) {
        series.push({
            name: platformNames[p],
            type: 'line',
            smooth: true,
            data: realData.trendData[p] || Array(7).fill(0),
            lineStyle: { color: platformColors[p], width: 1.5 },
            areaStyle: { 
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: platformColors[p] + '0D' },
                    { offset: 1, color: platformColors[p] + '00' }
                ]) 
            },
            symbol: 'circle',
            symbolSize: 3
        });
    }
    
    if (trendEl) {
        trendChart = echarts.init(trendEl);
        trendChart.setOption({
            tooltip: { 
                trigger: 'axis', 
                backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                borderColor: '#E8F0EE', 
                borderWidth: 1,
                textStyle: { color: '#3D5A4F' },
                boxShadow: '0 2px 6px rgba(45, 90, 78, 0.06)'
            },
            legend: { 
                show: true, 
                bottom: 0, 
                textStyle: { color: '#6B8A7D', fontSize: 11 }, 
                data: Object.values(platformNames),
                itemWidth: 10,
                itemHeight: 1.5
            },
            grid: { left: '3%', right: '4%', top: '10%', bottom: '18%', containLabel: true },
            xAxis: { 
                type: 'category', 
                data: realData.trendData.dates, 
                axisLine: { lineStyle: { color: '#E8F0EE' } }, 
                axisLabel: { color: '#6B8A7D', fontSize: 11 },
                axisTick: { show: false }
            },
            yAxis: { 
                type: 'value', 
                axisLine: { show: false }, 
                axisLabel: { color: '#6B8A7D', fontSize: 11 }, 
                splitLine: { lineStyle: { color: '#F0F6F4', type: 'dashed' } },
                axisTick: { show: false }
            },
            series: series
        });
    }
    
    if (pieEl) {
        pieChart = echarts.init(pieEl);
        pieChart.setOption({
            tooltip: { 
                trigger: 'item', 
                backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                borderColor: '#E8F0EE', 
                borderWidth: 1,
                textStyle: { color: '#3D5A4F' },
                boxShadow: '0 2px 6px rgba(45, 90, 78, 0.06)',
                formatter: '{b}: {c} ({d}%)' 
            },
            legend: { 
                orient: 'vertical', 
                right: '5%', 
                top: 'center', 
                textStyle: { color: '#6B8A7D', fontSize: 11 },
                itemWidth: 10,
                itemHeight: 1.5
            },
            series: [{ 
                name: '播放量', 
                type: 'pie', 
                radius: ['50%', '70%'], 
                center: ['35%', '50%'], 
                itemStyle: { 
                    borderRadius: 2, 
                    borderColor: '#FFFFFF', 
                    borderWidth: 1 
                },
                label: { show: false },
                labelLine: { show: false },
                emphasis: {
                    scale: true,
                    scaleSize: 4,
                    itemStyle: {
                        shadowBlur: 6,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(45, 90, 78, 0.08)'
                    }
                },
                data: realData.pieData.views.map(function(item) {
                    var colorMap = {
                        '抖音': '#5B8AB8',
                        '小红书': '#C4849E',
                        'B站': '#9B7BB8',
                        '快手': '#D4A56A',
                        '微信视频号': '#5BA87C'
                    };
                    return {
                        name: item.name,
                        value: item.value,
                        itemStyle: { color: colorMap[item.name] || '#5B8AB8' }
                    };
                })
            }]
        });
    }
    
    window.addEventListener('resize', function() {
        setTimeout(function() {
            if (trendChart) {
                trendChart.resize();
            }
            if (pieChart) {
                pieChart.resize();
            }
        }, 100);
    });
    
    // 页面可见性变化时也重新调整
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            setTimeout(function() {
                if (trendChart) trendChart.resize();
                if (pieChart) pieChart.resize();
            }, 200);
        }
    });
}

function switchTrendPeriod(period) {
    console.log('切换趋势周期:', period);
}

function switchPieChart(type) {
    if (!pieChart) return;
    
    var colorMap = {
        '抖音': '#5B8AB8',
        '小红书': '#C4849E',
        'B站': '#9B7BB8',
        '快手': '#D4A56A',
        '微信视频号': '#5BA87C'
    };
    
    var data = realData.pieData[type] || realData.pieData.views;
    var formattedData = data.map(function(item) {
        return {
            name: item.name,
            value: item.value,
            itemStyle: { color: colorMap[item.name] || '#5B8AB8' }
        };
    });
    
    pieChart.setOption({
        series: [{
            data: formattedData
        }]
    }, true);
}

function switchAccountPlatform(platform) {
    var navItems = document.querySelectorAll('.platform-nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
    }
    var activeNav = document.querySelector('[data-platform="' + platform + '"]');
    if (activeNav) activeNav.classList.add('active');
    
    var titles = { 
        all: '全部作品', 
        douyin: '抖音作品', 
        xiaohongshu: '小红书作品', 
        bilibili: 'B站作品',
        kuaishou: '快手作品',
        wechat: '微信视频号作品'
    };
    var titleEl = document.getElementById('accountPageTitle');
    if (titleEl) titleEl.textContent = titles[platform] || '全部作品';
    
    renderAccountWorksTable(platform);
}

function updateMultiSelect() {
    var checkboxes = document.querySelectorAll('.platform-multi-select input[type="checkbox"]');
    var selected = [];
    for (var i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            selected.push(checkboxes[i].value);
        }
    }
    var btn = document.querySelector('.multi-select-btn');
    if (btn) {
        btn.textContent = selected.length > 0 ? '应用筛选 (' + selected.length + ')' : '应用筛选';
    }
}

function applyMultiSelect() {
    var checkboxes = document.querySelectorAll('.platform-multi-select input[type="checkbox"]');
    var selected = [];
    for (var i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            selected.push(checkboxes[i].value);
        }
    }
    
    if (selected.length === 0) {
        switchAccountPlatform('all');
        return;
    }
    
    var navItems = document.querySelectorAll('.platform-nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
    }
    
    var platformNames = { douyin: '抖音', xiaohongshu: '小红书', bilibili: 'B站', kuaishou: '快手', wechat: '微信视频号' };
    var titleEl = document.getElementById('accountPageTitle');
    if (titleEl) titleEl.textContent = selected.map(function(p) { return platformNames[p]; }).join(' + ');
    
    renderAccountWorksTable(selected.join(','));
}

function renderAccountWorksTable(platform) {
    var container = document.getElementById('accountWorksTable');
    if (!container) return;
    
    var works = realData.works;
    if (platform !== 'all') {
        var platforms = platform.split(',');
        works = works.filter(function(w) { return platforms.includes(w.platform); });
    }
    
    var sortBy = document.getElementById('sortBy') ? document.getElementById('sortBy').value : 'likes';
    works.sort(function(a, b) {
        var valA = typeof a[sortBy] === 'number' ? a[sortBy] : 0;
        var valB = typeof b[sortBy] === 'number' ? b[sortBy] : 0;
        return valB - valA;
    });
    
    var platformNames = { douyin: '抖音', xiaohongshu: '小红书', bilibili: 'B站', kuaishou: '快手', wechat: '微信视频号' };
    
    var html = '<table class="works-table"><thead><tr><th>排名</th><th>平台</th><th>作品名称</th><th>发布时间</th><th>播放量</th><th>点赞量</th><th>收藏量</th><th>评论量</th><th>转发量</th><th>互动率</th></tr></thead><tbody>';
    for (var i = 0; i < works.length; i++) {
        var item = works[i];
        var rankClass = i < 3 ? 'top' : '';
        var platformTag = platformNames[item.platform] || item.platform;
        html += '<tr>' +
            '<td><span class="rank-badge ' + rankClass + '">' + (i + 1) + '</span></td>' +
            '<td><span class="platform-tag ' + item.platform + '">' + platformTag + '</span></td>' +
            '<td>' + item.title + '</td>' +
            '<td>' + (item.publish_time || '--') + '</td>' +
            '<td class="editable-cell" contenteditable="true" data-index="' + (item.rank - 1) + '" data-field="views" onblur="saveWorkData(' + (item.rank - 1) + ', \'views\', this.textContent)">' + formatNumber(item.views) + '</td>' +
            '<td>' + formatNumber(item.likes) + '</td>' +
            '<td>' + formatNumber(item.favorites) + '</td>' +
            '<td class="editable-cell" contenteditable="true" data-index="' + (item.rank - 1) + '" data-field="comments" onblur="saveWorkData(' + (item.rank - 1) + ', \'comments\', this.textContent)">' + formatNumber(item.comments) + '</td>' +
            '<td>' + formatNumber(item.shares) + '</td>' +
            '<td>' + item.rate + '</td>' +
            '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

function sortWorks() {
    var platform = document.querySelector('.platform-nav-item.active') ? document.querySelector('.platform-nav-item.active').dataset.platform : 'all';
    renderAccountWorksTable(platform);
}

function exportWorks() {
    var platform = document.querySelector('.platform-nav-item.active') ? document.querySelector('.platform-nav-item.active').dataset.platform : 'all';
    var works = realData.works;
    if (platform !== 'all') works = works.filter(function(w) { return w.platform === platform; });
    
    var csv = ['排名,平台,作品名称,播放量,点赞量,评论量,互动率'];
    for (var i = 0; i < works.length; i++) {
        var w = works[i];
        var platformName = w.platform === 'douyin' ? '抖音' : w.platform === 'xiaohongshu' ? '小红书' : 'B站';
        csv.push((i + 1) + ',' + platformName + ',' + w.title + ',' + w.views + ',' + w.likes + ',' + w.comments + ',' + w.rate);
    }
    
    var blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '作品数据_' + platform + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
}

function renderWorksGrid() {
    var container = document.getElementById('worksGrid');
    if (!container) return;
    
    var works = realData.works;
    
    var search = document.getElementById('workSearch') ? document.getElementById('workSearch').value : '';
    if (search) {
        works = works.filter(function(w) { return w.title.includes(search); });
    }
    
    var filter = document.getElementById('workFilter') ? document.getElementById('workFilter').value : 'all';
    if (filter !== 'all') {
        works = works.filter(function(w) { return w.platform === filter; });
    }
    
    works.sort(function(a, b) {
        return (b.likes || 0) - (a.likes || 0);
    });
    
    works = works.slice(0, 10);
    var html = '';
    for (var i = 0; i < works.length; i++) {
        var item = works[i];
        html += '<div class="work-card">' +
            '<div class="work-card-image"><i class="fas fa-play play-icon"></i></div>' +
            '<div class="work-card-content">' +
            '<div class="work-card-title">' + item.title + '</div>' +
            '<div class="work-card-stats">' +
            '<div class="work-card-stat"><span class="work-card-stat-value">' + formatNumber(item.views) + '</span><span class="work-card-stat-label">播放</span></div>' +
            '<div class="work-card-stat"><span class="work-card-stat-value">' + formatNumber(item.likes) + '</span><span class="work-card-stat-label">点赞</span></div>' +
            '<div class="work-card-stat"><span class="work-card-stat-value">' + formatNumber(item.comments) + '</span><span class="work-card-stat-label">评论</span></div>' +
            '</div></div></div>';
    }
    container.innerHTML = html;
}

function searchWorks() {
    renderWorksGrid();
}

function filterWorks() {
    renderWorksGrid();
}

function saveWorkData(index, field, value) {
    var numValue = value.trim() === '--' || value.trim() === '' ? '--' : parseInt(value.replace(/[^\d]/g, ''));
    realData.works[index][field] = numValue;
    
    if (field === 'views') {
        var views = realData.works[index].views;
        var likes = realData.works[index].likes;
        if (views !== '--' && typeof likes === 'number' && views > 0) {
            realData.works[index].rate = ((likes / views) * 100).toFixed(1) + '%';
        } else {
            realData.works[index].rate = '--';
        }
    }
    
    saveToLocalStorage();
    
    if (router.currentPage === 'accounts') {
        var platform = document.querySelector('.platform-nav-item.active') ? document.querySelector('.platform-nav-item.active').dataset.platform : 'all';
        renderAccountWorksTable(platform);
    } else if (router.currentPage === 'works') {
        renderWorksGrid();
    }
    
    // 纯静态模式，使用 localStorage
    saveToLocalStorage();
}

function saveToLocalStorage() {
    localStorage.setItem('liangyu_works_data', JSON.stringify(realData.works));
}

function loadFromLocalStorage() {
    var saved = localStorage.getItem('liangyu_works_data');
    if (saved) {
        try {
            var savedData = JSON.parse(saved);
            for (var i = 0; i < savedData.length; i++) {
                var savedItem = savedData[i];
                if (realData.works[i]) {
                    if (savedItem.views !== '--' && savedItem.views !== undefined) realData.works[i].views = savedItem.views;
                    if (savedItem.comments !== '--' && savedItem.comments !== undefined) realData.works[i].comments = savedItem.comments;
                    if (savedItem.rate !== '--' && savedItem.rate !== undefined) realData.works[i].rate = savedItem.rate;
                }
            }
        } catch (e) {
            console.error('Failed to load saved data:', e);
        }
    }
}

function refreshAllData() {
    loadAccountData();
    alert('数据刷新完成');
}

function refreshPlatformData(platform) {
    fetchAllPlatformData()
    .then(function() {
        updateAccountStats();
        var platformName = platform === 'douyin' ? '抖音' : platform === 'xiaohongshu' ? '小红书' : 'B站';
        alert(platformName + '数据刷新完成');
    });
}

function renderAccountList() {
    var container = document.getElementById('accountList');
    if (!container) return;
    
    var platforms = [
        { id: 'douyin', name: '抖音', img: '../Kevin/images/抖音.png' },
        { id: 'xiaohongshu', name: '小红书', img: '../Kevin/images/小红书.png' },
        { id: 'bilibili', name: 'B站', img: '../Kevin/images/B站%20logo.svg' }
    ];
    
    var html = '';
    for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        html += '<div class="account-item">' +
            '<img src="' + p.img + '" alt="' + p.name + '">' +
            '<div class="account-item-info">' +
            '<div class="account-item-name">' + p.name + '</div>' +
            '<div class="account-item-status">已绑定</div>' +
            '</div>' +
            '<button onclick="unbindAccount(\'' + p.id + '\')">解绑</button>' +
            '</div>';
    }
    container.innerHTML = html;
}

function unbindAccount(platform) {
    var platformName = platform === 'douyin' ? '抖音' : platform === 'xiaohongshu' ? '小红书' : 'B站';
    if (confirm('确定要解绑' + platformName + '账号吗？')) {
        alert('解绑成功');
        renderAccountList();
    }
}

function switchImportMode(mode) {
    var btns = document.querySelectorAll('.import-tab-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    
    var activeBtn = document.querySelector('.import-tab-btn[onclick="switchImportMode(\'' + mode + '\')"]');
    if (activeBtn) activeBtn.classList.add('active');
    
    document.getElementById('import-upload-panel').style.display = mode === 'upload' ? 'block' : 'none';
    document.getElementById('import-manual-panel').style.display = mode === 'manual' ? 'block' : 'none';
}

function handleFileUpload() {
    var fileInput = document.getElementById('importFileInput');
    var file = fileInput.files[0];
    var platform = document.getElementById('importPlatformSelect').value;
    
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        var reader = new FileReader();
        reader.onload = function(e) {
            var content = e.target.result;
            var lines = content.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('文件内容为空');
                return;
            }
            
            var headers = lines[0].split(',').map(h => h.trim());
            var newCount = 0;
            var updatedCount = 0;
            
            for (var i = 1; i < lines.length; i++) {
                var values = lines[i].split(',');
                var row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] ? values[idx].trim() : '';
                });
                
                var title = row['标题'] || row['title'] || row['作品名称'];
                if (!title) continue;
                
                var existing = realData.works.find(w => w.title === title && w.platform === platform);
                var work = {
                    id: existing ? existing.id : Date.now(),
                    rank: 0,
                    platform: platform,
                    title: title,
                    publish_time: row['发布时间'] || row['publish_time'] || row['时间'] || '',
                    views: row['播放量'] || row['播放'] || row['views'] || '--',
                    likes: parseInt(row['点赞'] || row['likes'] || '0'),
                    favorites: parseInt(row['收藏'] || row['favorites'] || '0'),
                    comments: row['评论'] || row['comments'] || '--',
                    shares: parseInt(row['转发'] || row['分享'] || row['shares'] || '0'),
                    rate: row['转化率'] || row['rate'] || '--'
                };
                
                if (existing) {
                    var idx = realData.works.indexOf(existing);
                    realData.works[idx] = work;
                    updatedCount++;
                } else {
                    realData.works.push(work);
                    newCount++;
                }
            }
            
            saveToLocalStorage();
            showImportResult(newCount, updatedCount);
            fileInput.value = '';
            loadAccountData();
        };
        reader.readAsText(file);
    } else {
        alert('纯静态模式仅支持CSV文件，请上传CSV格式');
    }
}

function showImportResult(newCount, updatedCount) {
    var modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.innerHTML = `
        <div class="result-modal-content">
            <div class="result-icon success"><i class="fas fa-check-circle"></i></div>
            <h3>数据导入完成</h3>
            <div class="result-stats">
                <div class="result-stat">
                    <span class="stat-value">${newCount}</span>
                    <span class="stat-label">新增作品</span>
                </div>
                <div class="result-stat">
                    <span class="stat-value">${updatedCount}</span>
                    <span class="stat-label">更新作品</span>
                </div>
            </div>
            <button class="close-result-btn" onclick="this.closest('.result-modal').remove()">确定</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function submitManualWork() {
    var platform = document.getElementById('manualPlatform').value;
    var title = document.getElementById('manualTitle').value;
    var publishTime = document.getElementById('manualPublishTime').value;
    var views = document.getElementById('manualViews').value;
    var likes = document.getElementById('manualLikes').value;
    var favorites = document.getElementById('manualFavorites').value;
    var comments = document.getElementById('manualComments').value;
    var shares = document.getElementById('manualShares').value;
    
    if (!title) {
        alert('请输入作品标题');
        return;
    }
    
    // 纯静态模式，使用 localStorage
    var existing = realData.works.find(w => w.title === title && w.platform === platform);
    var work = {
        id: existing ? existing.id : Date.now(),
        rank: 0,
        platform: platform,
        title: title,
        publish_time: publishTime || '',
        views: views || '--',
        likes: parseInt(likes) || 0,
        favorites: parseInt(favorites) || 0,
        comments: comments || '--',
        shares: parseInt(shares) || 0,
        rate: '--'
    };
    
    if (existing) {
        var idx = realData.works.indexOf(existing);
        realData.works[idx] = work;
        alert('作品已更新');
    } else {
        realData.works.push(work);
        alert('作品添加成功');
    }
    
    saveToLocalStorage();
    
    document.getElementById('manualTitle').value = '';
    document.getElementById('manualPublishTime').value = '';
    document.getElementById('manualViews').value = '';
    document.getElementById('manualLikes').value = '';
    document.getElementById('manualFavorites').value = '';
    document.getElementById('manualComments').value = '';
    document.getElementById('manualShares').value = '';
    
    loadAccountData();
}

function importData() {
    var file = document.getElementById('importFile').files[0];
    var platform = document.getElementById('importPlatform').value;
    var token = localStorage.getItem('liangyu_token');
    
    if (!file) {
        alert('请选择要导入的文件');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data;
            if (file.name.endsWith('.json')) {
                data = JSON.parse(e.target.result);
            } else if (file.name.endsWith('.csv')) {
                var lines = e.target.result.split('\n').filter(function(l) { return l.trim(); });
                var headers = lines[0].split(',');
                data = { works: [] };
                for (var i = 1; i < lines.length; i++) {
                    var values = lines[i].split(',');
                    var row = {};
                    headers.forEach(function(h, idx) { row[h.trim()] = values[idx] ? values[idx].trim() : ''; });
                    if (row.title) {
                        data.works.push(row);
                    }
                }
            }
            
            fetch(BACKEND_URL + '/api/import/json', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ platform: platform, data: data })
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(result) {
                if (result.success) {
                    var stats = result.stats || {};
                    showImportResult(stats.new || 0, stats.updated || 0);
                    loadAccountData();
                } else {
                    alert('导入失败: ' + result.error);
                }
            })
            .catch(function(error) {
                alert('导入失败: ' + error.message);
            });
        } catch (error) {
            alert('导入失败: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', function() {
    var token = localStorage.getItem('liangyu_token');
    if (token) {
        var userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = localStorage.getItem('liangyu_username') || '用户';
        }
    }
    
    renderAccountList();
    renderWorksGrid();
});
