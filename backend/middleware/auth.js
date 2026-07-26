const jwt = require('jsonwebtoken');
const { getAsync } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'liangyu_secret_key';

function generateToken(user) {
    return jwt.sign({ userId: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
}

async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: '未授权，请先登录' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getAsync('SELECT id, phone, nickname FROM users WHERE id = ?', [decoded.userId]);
        
        if (!user) {
            return res.status(401).json({ success: false, error: '用户不存在' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'token无效或已过期' });
    }
}

module.exports = {
    generateToken,
    authenticate,
    JWT_SECRET
};