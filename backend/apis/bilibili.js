const https = require('https');
const querystring = require('querystring');

const CLIENT_ID = 'your_bilibili_client_id';
const CLIENT_SECRET = 'your_bilibili_client_secret';
const REDIRECT_URI = 'http://localhost:3000/api/bilibili/callback';

function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function getAuthorizeUrl() {
    const params = querystring.stringify({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'user_info,video_upload',
        state: 'liangyu_dashboard'
    });
    return `https://oauth.bilibili.com/authorize?${params}`;
}

async function getAccessToken(code) {
    const data = querystring.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI
    });
    
    const options = {
        hostname: 'oauth.bilibili.com',
        path: '/access_token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    };
    
    return request(options, data);
}

async function refreshToken(refreshToken) {
    const data = querystring.stringify({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken
    });
    
    const options = {
        hostname: 'oauth.bilibili.com',
        path: '/access_token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    };
    
    return request(options, data);
}

async function getUserInfo(accessToken) {
    const options = {
        hostname: 'api.bilibili.com',
        path: `/x/web-interface/nav?access_key=${accessToken}`,
        method: 'GET'
    };
    return request(options);
}

async function getSpaceInfo(mid) {
    const options = {
        hostname: 'api.bilibili.com',
        path: `/x/space/acc/info?mid=${mid}`,
        method: 'GET'
    };
    return request(options);
}

async function getVideoList(mid, page = 1, pageSize = 20) {
    const options = {
        hostname: 'api.bilibili.com',
        path: `/x/space/wbi/arc/search?mid=${mid}&ps=${pageSize}&p=${page}`,
        method: 'GET'
    };
    return request(options);
}

async function getVideoStats(aid) {
    const options = {
        hostname: 'api.bilibili.com',
        path: `/x/web-interface/archive/stat?aid=${aid}`,
        method: 'GET'
    };
    return request(options);
}

module.exports = {
    getAuthorizeUrl,
    getAccessToken,
    refreshToken,
    getUserInfo,
    getSpaceInfo,
    getVideoList,
    getVideoStats
};