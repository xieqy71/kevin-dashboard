const express = require('express');
const { runAsync, getAsync, allAsync } = require('../db');
const { generateToken, authenticate } = require('../middleware/auth');
const QRCode = require('qrcode');

const router = express.Router();

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateWechatState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

router.post('/sms/send', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ success: false, error: '请输入正确的手机号码' });
        }
        
        const code = process.env.NODE_ENV === 'production' 
            ? generateVerificationCode() 
            : '123456';
        
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        
        await runAsync(`
            INSERT OR REPLACE INTO verification_codes (phone, code, expires_at)
            VALUES (?, ?, ?)
        `, [phone, code, expiresAt]);
        
        console.log(`发送验证码: ${phone} -> ${code}`);
        
        res.json({ 
            success: true, 
            message: '验证码已发送',
            expiresIn: 300 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/sms/verify', async (req, res) => {
    try {
        const { phone, code } = req.body;
        
        if (!phone || !code) {
            return res.status(400).json({ success: false, error: '请输入手机号和验证码' });
        }
        
        const verification = await getAsync('SELECT * FROM verification_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1', [phone]);
        
        if (!verification) {
            return res.status(400).json({ success: false, error: '请先获取验证码' });
        }
        
        if (new Date(verification.expires_at) < new Date()) {
            return res.status(400).json({ success: false, error: '验证码已过期，请重新获取' });
        }
        
        if (verification.code !== code) {
            return res.status(400).json({ success: false, error: '验证码错误' });
        }
        
        let user = await getAsync('SELECT * FROM users WHERE phone = ?', [phone]);
        
        if (!user) {
            await runAsync('INSERT INTO users (phone, nickname) VALUES (?, ?)', [phone, `用户${phone.slice(-4)}`]);
            user = await getAsync('SELECT * FROM users WHERE phone = ?', [phone]);
            
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'douyin', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'xiaohongshu', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'bilibili', 'pending']);
        }
        
        const token = generateToken(user);
        
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    nickname: user.nickname,
                    avatar: user.avatar
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/wechat/qrcode', async (req, res) => {
    try {
        const state = generateWechatState();
        
        await runAsync(`
            INSERT OR REPLACE INTO verification_codes (phone, code, expires_at)
            VALUES (?, ?, ?)
        `, ['wechat', state, new Date(Date.now() + 5 * 60 * 1000).toISOString()]);
        
        const callbackUrl = encodeURIComponent('http://localhost:3000/api/auth/wechat/callback');
        const wechatAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=wx8654806612345678&redirect_uri=${callbackUrl}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
        
        const qrcodeDataUrl = await QRCode.toDataURL(wechatAuthUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        
        res.json({
            success: true,
            data: {
                qrcodeDataUrl,
                state,
                authUrl: wechatAuthUrl,
                message: '开发环境模拟：点击下方按钮模拟扫码登录'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/wechat/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!state) {
            return res.status(400).json({ success: false, error: '缺少state参数' });
        }
        
        const verifyState = await getAsync('SELECT * FROM verification_codes WHERE phone = ? AND code = ?', ['wechat', state]);
        
        if (!verifyState || new Date(verifyState.expires_at) < new Date()) {
            return res.status(400).json({ success: false, error: '二维码已过期，请重新获取' });
        }
        
        let user = await getAsync('SELECT * FROM users WHERE openid = ?', ['wx_openid_' + state]);
        
        if (!user) {
            const nickname = '微信用户' + Math.floor(1000 + Math.random() * 9000);
            await runAsync('INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)', [
                'wx_openid_' + state,
                nickname,
                'https://api.dicebear.com/7.x/avataaars/svg?seed=' + state
            ]);
            user = await getAsync('SELECT * FROM users WHERE openid = ?', ['wx_openid_' + state]);
            
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'douyin', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'xiaohongshu', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'bilibili', 'pending']);
        }
        
        const token = generateToken(user);
        
        res.redirect(`/#bind?token=${encodeURIComponent(token)}&nickname=${encodeURIComponent(user.nickname)}`);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/wechat/mock-login', async (req, res) => {
    try {
        const { state } = req.body;
        
        if (!state) {
            return res.status(400).json({ success: false, error: '缺少state参数' });
        }
        
        const verifyState = await getAsync('SELECT * FROM verification_codes WHERE phone = ? AND code = ?', ['wechat', state]);
        
        if (!verifyState || new Date(verifyState.expires_at) < new Date()) {
            return res.status(400).json({ success: false, error: '二维码已过期，请重新获取' });
        }
        
        let user = await getAsync('SELECT * FROM users WHERE openid = ?', ['wx_openid_' + state]);
        
        if (!user) {
            const nickname = '微信用户' + Math.floor(1000 + Math.random() * 9000);
            await runAsync('INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)', [
                'wx_openid_' + state,
                nickname,
                'https://api.dicebear.com/7.x/avataaars/svg?seed=' + state
            ]);
            user = await getAsync('SELECT * FROM users WHERE openid = ?', ['wx_openid_' + state]);
            
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'douyin', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'xiaohongshu', 'pending']);
            await runAsync('INSERT OR IGNORE INTO platform_connections (user_id, platform, status) VALUES (?, ?, ?)', [user.id, 'bilibili', 'pending']);
        }
        
        const token = generateToken(user);
        
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    nickname: user.nickname,
                    avatar: user.avatar
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/logout', async (req, res) => {
    try {
        res.json({ success: true, message: '已退出登录' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const scanSessions = {};

router.post('/platform/bind/qrcode', authenticate, async (req, res) => {
    try {
        const { platform } = req.body;
        const userId = req.user.id;
        
        const scene = generateWechatState();
        
        const authUrl = `http://localhost:3000/authorize.html?platform=${platform}&scene=${scene}&userId=${userId}`;
        
        const qrcodeDataUrl = await QRCode.toDataURL(authUrl, {
            width: 200,
            margin: 2
        });
        
        scanSessions[scene] = {
            userId: userId,
            platform: platform,
            status: 'waiting',
            createdAt: Date.now()
        };
        
        res.json({
            success: true,
            data: {
                qrcodeDataUrl,
                scene,
                platform,
                authUrl
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/platform/bind/status/:scene', async (req, res) => {
    try {
        const { scene } = req.params;
        
        const session = scanSessions[scene];
        
        if (!session) {
            return res.json({ success: true, data: { status: 'expired' } });
        }
        
        res.json({ success: true, data: { status: session.status } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/platform/bind/callback', async (req, res) => {
    try {
        const { platform, scene, userId } = req.query;
        
        if (!scanSessions[scene]) {
            return res.json({ success: false, error: '二维码已过期' });
        }
        
        scanSessions[scene].status = 'scanned';
        
        await runAsync(`
            INSERT OR REPLACE INTO platform_connections (user_id, platform, status, connected_at)
            VALUES (?, ?, ?, ?)
        `, [userId, platform, 'connected', new Date().toISOString()]);
        
        res.json({ success: true, message: '绑定成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/platform/bind/mock', async (req, res) => {
    try {
        const { scene } = req.body;
        
        if (!scanSessions[scene]) {
            return res.status(400).json({ success: false, error: '二维码已过期' });
        }
        
        const session = scanSessions[scene];
        session.status = 'scanned';
        
        await runAsync(`
            INSERT OR REPLACE INTO platform_connections (user_id, platform, status, connected_at)
            VALUES (?, ?, ?, ?)
        `, [session.userId, session.platform, 'connected', new Date().toISOString()]);
        
        res.json({ success: true, data: { status: 'scanned' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;