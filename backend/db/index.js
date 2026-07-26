const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'liangyu.db');

function ensureDbDir() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
}

function createDb() {
    ensureDbDir();
    const db = new sqlite3.Database(DB_PATH);
    
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                name TEXT,
                fans TEXT,
                likes TEXT,
                works INTEGER DEFAULT 0,
                following TEXT,
                today_views INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS works (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                title TEXT,
                publish_time TEXT,
                views TEXT DEFAULT '--',
                likes INTEGER DEFAULT 0,
                favorites INTEGER DEFAULT 0,
                comments TEXT DEFAULT '--',
                shares INTEGER DEFAULT 0,
                rate TEXT DEFAULT '--',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(platform, title, publish_time)
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                platform TEXT NOT NULL,
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, platform)
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS api_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                expires_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(platform)
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE,
                nickname TEXT,
                avatar TEXT,
                openid TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS platform_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                connected_at TEXT,
                disconnected_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, platform)
            )
        `);
    });
    
    return db;
}

const db = createDb();

async function migrateWorksTable() {
    const migrations = [
        'ALTER TABLE works ADD COLUMN publish_time TEXT',
        'ALTER TABLE works ADD COLUMN favorites INTEGER DEFAULT 0',
        'ALTER TABLE works ADD COLUMN shares INTEGER DEFAULT 0'
    ];
    
    for (const sql of migrations) {
        try {
            await runAsync(sql);
            console.log('Migration executed:', sql);
        } catch (error) {
            console.log('Migration skipped (column may already exist):', error.message);
        }
    }
}

migrateWorksTable();

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function initDefaultData() {
    const douyinExists = await getAsync('SELECT id FROM accounts WHERE platform = ?', ['douyin']);
    if (!douyinExists) {
        await runAsync('INSERT INTO accounts (platform, name, fans, likes, works, following) VALUES (?, ?, ?, ?, ?, ?)', 
            ['douyin', 'Kevin科奇', '114', '5135', 16, '14']);
    }
    
    const xhsExists = await getAsync('SELECT id FROM accounts WHERE platform = ?', ['xiaohongshu']);
    if (!xhsExists) {
        await runAsync('INSERT INTO accounts (platform, name, fans, likes, works, following) VALUES (?, ?, ?, ?, ?, ?)', 
            ['xiaohongshu', 'Kevin科奇', '10+', '1千+', 29, '10+']);
    }
    
    const biliExists = await getAsync('SELECT id FROM accounts WHERE platform = ?', ['bilibili']);
    if (!biliExists) {
        await runAsync('INSERT INTO accounts (platform, name, fans, likes, works, following) VALUES (?, ?, ?, ?, ?, ?)', 
            ['bilibili', 'Kevin科奇', '--', '--', 0, '--']);
    }
    
    const defaultWorks = [
        { platform: 'douyin', title: '王老吉VS补水啦 饮料PK', views: '--', likes: 3705, comments: '--', rate: '--' },
        { platform: 'douyin', title: '岁月放过了诸神，却落下了内马尔', views: '--', likes: 300, comments: '--', rate: '--' },
        { platform: 'douyin', title: '补水啦完胜王老吉', views: '--', likes: 222, comments: '--', rate: '--' },
        { platform: 'douyin', title: '哈兰德姆巴佩喝起了交杯酒', views: '--', likes: 206, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '逆天啊？世界杯惊天空门不进！', views: '--', likes: 811, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '天神下凡！哈兰德双响', views: '--', likes: 495, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '哈兰德绝杀！挪威时隔28年重返16强', views: '--', likes: 486, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '贡献五大囧！杨瀚森今日10+5', views: '--', likes: 290, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '中国男篮92:74战胜中国台北', views: '--', likes: 280, comments: '--', rate: '--' },
        { platform: 'xiaohongshu', title: '提问环节！02国足VS佛得角', views: '--', likes: 106, comments: '--', rate: '--' }
    ];
    
    for (const work of defaultWorks) {
        await runAsync(`
            INSERT OR REPLACE INTO works (platform, title, publish_time, views, likes, favorites, comments, shares, rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [work.platform, work.title, work.publish_time || '', work.views, work.likes, work.favorites || 0, work.comments, work.shares || 0, work.rate]);
    }
    
    console.log('Default data initialized');
}

module.exports = {
    db,
    runAsync,
    getAsync,
    allAsync,
    initDefaultData
};