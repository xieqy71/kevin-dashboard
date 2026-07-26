const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { runAsync, getAsync, allAsync, initDefaultData } = require('./db');
const bilibiliApi = require('./apis/bilibili');
const { authenticate } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', authRoutes);

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

initDefaultData();

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/platform-connections', authenticate, async (req, res) => {
    try {
        const connections = await allAsync('SELECT * FROM platform_connections WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: connections });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/platform-connections/:platform', authenticate, async (req, res) => {
    try {
        const { status } = req.body;
        await runAsync(`
            UPDATE platform_connections 
            SET status = ?, connected_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND platform = ?
        `, [status, status === 'connected' ? new Date().toISOString() : null, req.user.id, req.params.platform]);
        
        const updated = await getAsync('SELECT * FROM platform_connections WHERE user_id = ? AND platform = ?', [req.user.id, req.params.platform]);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/accounts', authenticate, async (req, res) => {
    try {
        const accounts = await allAsync('SELECT * FROM accounts');
        res.json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/accounts/:platform', authenticate, async (req, res) => {
    try {
        const account = await getAsync('SELECT * FROM accounts WHERE platform = ?', [req.params.platform]);
        if (account) {
            res.json({ success: true, data: account });
        } else {
            res.status(404).json({ success: false, error: 'Account not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/accounts/:platform', authenticate, async (req, res) => {
    try {
        const { name, fans, likes, works, following, today_views } = req.body;
        await runAsync(`
            UPDATE accounts 
            SET name = ?, fans = ?, likes = ?, works = ?, following = ?, today_views = ?, updated_at = CURRENT_TIMESTAMP
            WHERE platform = ?
        `, [name, fans, likes, works, following, today_views || 0, req.params.platform]);
        
        const updated = await getAsync('SELECT * FROM accounts WHERE platform = ?', [req.params.platform]);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/works', authenticate, async (req, res) => {
    try {
        const { platform } = req.query;
        let sql = 'SELECT * FROM works';
        let params = [];
        
        if (platform) {
            const platforms = platform.split(',');
            if (platforms.length > 1) {
                sql += ' WHERE platform IN (' + platforms.map(() => '?').join(',') + ')';
                params.push(...platforms);
            } else {
                sql += ' WHERE platform = ?';
                params.push(platform);
            }
        }
        
        sql += ' ORDER BY likes DESC';
        const works = await allAsync(sql, params);
        res.json({ success: true, data: works });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/works/:id', authenticate, async (req, res) => {
    try {
        const { views, likes, favorites, comments, shares, rate } = req.body;
        await runAsync(`
            UPDATE works 
            SET views = ?, likes = ?, favorites = ?, comments = ?, shares = ?, rate = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [views, likes, favorites, comments, shares, rate, req.params.id]);
        
        const updated = await getAsync('SELECT * FROM works WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/works', authenticate, async (req, res) => {
    try {
        const { platform, title, publish_time, views, likes, favorites, comments, shares, rate } = req.body;
        
        const existing = await getAsync(
            'SELECT id FROM works WHERE platform = ? AND title = ? AND (publish_time = ? OR (publish_time IS NULL AND ? IS NULL))',
            [platform, title, publish_time || '', publish_time || '']
        );
        
        if (existing) {
            await runAsync(`
                UPDATE works SET views = ?, likes = ?, favorites = ?, comments = ?, shares = ?, rate = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [views || '--', likes || 0, favorites || 0, comments || '--', shares || 0, rate || '--', existing.id]);
            const updated = await getAsync('SELECT * FROM works WHERE id = ?', [existing.id]);
            return res.json({ success: true, data: updated, updated: true });
        }
        
        const result = await runAsync(`
            INSERT INTO works (platform, title, publish_time, views, likes, favorites, comments, shares, rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [platform, title, publish_time || '', views || '--', likes || 0, favorites || 0, comments || '--', shares || 0, rate || '--']);
        
        const newWork = await getAsync('SELECT * FROM works WHERE id = ?', [result.lastID]);
        res.json({ success: true, data: newWork, updated: false });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/works/:id', authenticate, async (req, res) => {
    try {
        await runAsync('DELETE FROM works WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/all/data', authenticate, async (req, res) => {
    try {
        const [accounts, works] = await Promise.all([
            allAsync('SELECT * FROM accounts'),
            allAsync('SELECT * FROM works ORDER BY likes DESC LIMIT 10')
        ]);
        
        const accountMap = {};
        accounts.forEach(acc => {
            accountMap[acc.platform] = {
                name: acc.name,
                fans: acc.fans,
                likes: acc.likes,
                works: acc.works,
                following: acc.following,
                todayViews: acc.today_views
            };
        });
        
        const worksList = works.map(w => ({
                id: w.id,
                title: w.title,
                publish_time: w.publish_time,
                views: w.views,
                likes: w.likes,
                favorites: w.favorites,
                comments: w.comments,
                shares: w.shares,
                rate: w.rate,
                platform: w.platform
            }));
        
        res.json({
            success: true,
            data: {
                accounts: accountMap,
                works: worksList
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/import/json', authenticate, async (req, res) => {
    try {
        const { platform, data } = req.body;
        
        if (data.account) {
            await runAsync(`
                INSERT OR REPLACE INTO accounts (platform, name, fans, likes, works, following)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [platform, data.account.name, data.account.fans, data.account.likes, data.account.works, data.account.following]);
        }
        
        let newCount = 0;
        let updatedCount = 0;
        
        if (data.works && Array.isArray(data.works)) {
            for (const work of data.works) {
                const existing = await getAsync(
                    'SELECT id FROM works WHERE platform = ? AND title = ? AND (publish_time = ? OR (publish_time IS NULL AND ? IS NULL))',
                    [platform, work.title, work.publish_time || '', work.publish_time || '']
                );
                
                const isNew = !existing;
                
                await runAsync(`
                    INSERT OR REPLACE INTO works (platform, title, publish_time, views, likes, favorites, comments, shares, rate, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [platform, work.title, work.publish_time || '', work.views || '--', work.likes || 0, work.favorites || 0, work.comments || '--', work.shares || 0, work.rate || '--']);
                
                if (isNew) newCount++;
                else updatedCount++;
            }
        }
        
        res.json({ 
            success: true, 
            message: '数据导入成功',
            stats: {
                total: data.works?.length || 0,
                new: newCount,
                updated: updatedCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

function parseFieldName(header) {
    const headerLower = header.toLowerCase().trim();
    if (headerLower.includes('标题') || headerLower.includes('作品名称') || headerLower === 'title') return 'title';
    if (headerLower.includes('发布时间') || headerLower.includes('时间') || headerLower === 'time' || headerLower === 'date' || headerLower === 'publish_time') return 'publish_time';
    if (headerLower.includes('播放') || headerLower.includes('观看') || headerLower === 'views' || headerLower === 'view') return 'views';
    if (headerLower.includes('点赞') || headerLower === 'likes' || headerLower === 'like') return 'likes';
    if (headerLower.includes('收藏') || headerLower === 'favorites' || headerLower === 'favorite' || headerLower === 'collect') return 'favorites';
    if (headerLower.includes('评论') || headerLower === 'comments' || headerLower === 'comment') return 'comments';
    if (headerLower.includes('转发') || headerLower.includes('分享') || headerLower === 'shares' || headerLower === 'share') return 'shares';
    return null;
}

function parseNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const clean = value.replace(/[^\d]/g, '');
        return clean ? parseInt(clean) : 0;
    }
    return 0;
}

function parseViews(value) {
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
        return value.trim() || '--';
    }
    return '--';
}

app.post('/api/import/file', authenticate, upload.single('file'), async (req, res) => {
    try {
        const { platform } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: '请上传文件' });
        }
        
        const ext = path.extname(req.file.originalname).toLowerCase();
        let rows = [];
        
        if (ext === '.xlsx' || ext === '.xls') {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            rows = xlsx.utils.sheet_to_json(worksheet);
        } else if (ext === '.csv') {
            const content = fs.readFileSync(req.file.path, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] ? values[idx].trim() : '';
                });
                if (Object.keys(row).some(k => row[k])) {
                    rows.push(row);
                }
            }
        } else {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: '不支持的文件格式，请上传Excel或CSV文件' });
        }
        
        let newCount = 0;
        let updatedCount = 0;
        
        for (const row of rows) {
            const mapped = {};
            for (const key of Object.keys(row)) {
                const field = parseFieldName(key);
                if (field) {
                    mapped[field] = row[key];
                }
            }
            
            if (!mapped.title) continue;
            
            const existing = await getAsync(
                'SELECT id FROM works WHERE platform = ? AND title = ? AND (publish_time = ? OR (publish_time IS NULL AND ? IS NULL))',
                [platform, mapped.title, mapped.publish_time || '', mapped.publish_time || '']
            );
            
            const isNew = !existing;
            
            await runAsync(`
                INSERT OR REPLACE INTO works (platform, title, publish_time, views, likes, favorites, comments, shares, rate, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                platform,
                mapped.title,
                mapped.publish_time || '',
                parseViews(mapped.views),
                parseNumber(mapped.likes),
                parseNumber(mapped.favorites),
                parseViews(mapped.comments),
                parseNumber(mapped.shares),
                '--'
            ]);
            
            if (isNew) {
                newCount++;
            } else {
                updatedCount++;
            }
        }
        
        fs.unlinkSync(req.file.path);
        res.json({ 
            success: true, 
            message: '数据导入成功',
            stats: {
                total: rows.length,
                new: newCount,
                updated: updatedCount
            }
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bilibili/auth-url', authenticate, async (req, res) => {
    try {
        const url = await bilibiliApi.getAuthorizeUrl();
        
        if (url.includes('your_bilibili_client_id')) {
            return res.json({ 
                success: false, 
                error: '请先在backend/apis/bilibili.js中配置B站OAuth的client_id和client_secret' 
            });
        }
        
        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bilibili/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ success: false, error: '缺少授权码' });
        }
        
        const tokenResult = await bilibiliApi.getAccessToken(code);
        
        if (tokenResult.access_token) {
            await runAsync(`
                INSERT OR REPLACE INTO api_tokens (platform, access_token, refresh_token, expires_at)
                VALUES (?, ?, ?, ?)
            `, ['bilibili', tokenResult.access_token, tokenResult.refresh_token, 
                 new Date(Date.now() + (tokenResult.expires_in || 3600) * 1000).toISOString()]);
            
            const userInfo = await bilibiliApi.getUserInfo(tokenResult.access_token);
            if (userInfo.data) {
                const spaceInfo = await bilibiliApi.getSpaceInfo(userInfo.data.mid);
                
                await runAsync(`
                    INSERT OR REPLACE INTO accounts (platform, name, fans, likes, works)
                    VALUES (?, ?, ?, ?, ?)
                `, ['bilibili', userInfo.data.uname, 
                     spaceInfo.data?.follower || '--', 
                     spaceInfo.data?.likes || '--', 
                     spaceInfo.data?.archive_count || 0]);
            }
            
            res.json({ success: true, message: 'B站授权成功', data: tokenResult });
        } else {
            res.json({ success: false, error: tokenResult.message || '授权失败' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bilibili/fetch-data', async (req, res) => {
    try {
        const token = await getAsync('SELECT * FROM api_tokens WHERE platform = ?', ['bilibili']);
        if (!token) {
            return res.json({ success: false, error: '请先完成B站OAuth授权' });
        }
        
        const userInfo = await bilibiliApi.getUserInfo(token.access_token);
        if (!userInfo.data) {
            return res.json({ success: false, error: '获取用户信息失败' });
        }
        
        const [spaceInfo, videoList] = await Promise.all([
            bilibiliApi.getSpaceInfo(userInfo.data.mid),
            bilibiliApi.getVideoList(userInfo.data.mid)
        ]);
        
        await runAsync(`
            UPDATE accounts SET fans = ?, likes = ?, works = ?, updated_at = CURRENT_TIMESTAMP
            WHERE platform = ?
        `, [spaceInfo.data?.follower || '--', spaceInfo.data?.likes || '--', 
            spaceInfo.data?.archive_count || 0, 'bilibili']);
        
        if (videoList.data?.list?.vlist) {
            for (const video of videoList.data.list.vlist.slice(0, 10)) {
                const stat = await bilibiliApi.getVideoStats(video.aid);
                await runAsync(`
                    INSERT OR REPLACE INTO works (platform, title, views, likes, comments, rate)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, ['bilibili', video.title, video.play, video.like, video.comment, '--']);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'B站数据同步成功',
            data: {
                name: userInfo.data.uname,
                fans: spaceInfo.data?.follower,
                likes: spaceInfo.data?.likes,
                works: spaceInfo.data?.archive_count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/trends', async (req, res) => {
    try {
        const { platform, days = 7 } = req.query;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        
        let sql = `SELECT * FROM trends WHERE date >= ? AND date <= ?`;
        let params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
        
        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }
        
        sql += ' ORDER BY date ASC';
        const trends = await allAsync(sql, params);
        
        const platformTrends = {};
        trends.forEach(t => {
            if (!platformTrends[t.platform]) {
                platformTrends[t.platform] = [];
            }
            platformTrends[t.platform].push({ date: t.date, views: t.views, likes: t.likes });
        });
        
        res.json({ success: true, data: platformTrends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/trends', async (req, res) => {
    try {
        const { date, platform, views, likes } = req.body;
        await runAsync(`
            INSERT OR REPLACE INTO trends (date, platform, views, likes)
            VALUES (?, ?, ?, ?)
        `, [date, platform, views || 0, likes || 0]);
        
        res.json({ success: true, message: '趋势数据已保存' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`后端服务运行在 http://localhost:${PORT}`);
    console.log('合规架构说明：');
    console.log('  1. 所有数据存储在本地SQLite数据库');
    console.log('  2. B站支持OAuth官方API授权');
    console.log('  3. 抖音/小红书通过手动导入CSV/JSON数据');
    console.log('  4. 前端可直接编辑数据，数据实时保存');
});