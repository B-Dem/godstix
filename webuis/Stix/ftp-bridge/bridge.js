const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const { Readable, PassThrough, Transform } = require('stream');

let config = {
    httpPort: 7860,
    ftpHost: '192.168.1.100',
    ftpPort: 21,
    ftpUser: 'xboxftp',
    ftpPass: 'xboxftp',
    ftpSecure: false
};

const configPath = path.join(__dirname, 'bridge-config.json');
if (fs.existsSync(configPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        Object.assign(config, loaded);
        console.log('[Bridge] Loaded config from bridge-config.json');
    } catch (e) {
        console.error('[Bridge] Error reading config:', e.message);
    }
}

if (process.env.FTP_HOST) config.ftpHost = process.env.FTP_HOST;
if (process.env.FTP_PORT) config.ftpPort = parseInt(process.env.FTP_PORT);
if (process.env.FTP_USER) config.ftpUser = process.env.FTP_USER;
if (process.env.FTP_PASS) config.ftpPass = process.env.FTP_PASS;
if (process.env.HTTP_PORT) config.httpPort = parseInt(process.env.HTTP_PORT);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
    dest: path.join(__dirname, '.uploads'),
    limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 20 }
});

const transfers = {};
let transferIdCounter = 0;

function normalizePath(p) {
    if (!p || p === '/') return '/';
    let normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
}

async function getFtpClient() {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    await client.access({
        host: config.ftpHost,
        port: config.ftpPort,
        user: config.ftpUser,
        password: config.ftpPass,
        secure: config.ftpSecure
    });
    return client;
}

async function cdToPath(client, targetPath) {
    const normalized = normalizePath(targetPath);
    if (normalized === '/') {
        await client.cd('/');
        return;
    }
    const segments = normalized.split('/').filter(s => s.length > 0);
    await client.cd('/');
    for (const segment of segments) {
        await client.cd(segment);
    }
}

app.get('/status', async (req, res) => {
    let ftpOk = false;
    let ftpError = null;
    try {
        const client = await getFtpClient();
        ftpOk = true;
        client.close();
    } catch (e) {
        ftpError = e.message;
    }
    res.json({
        status: 'ok',
        type: 'godsend-ftp-bridge',
        version: '1.0.0',
        ftp: {
            connected: ftpOk,
            host: config.ftpHost,
            port: config.ftpPort,
            error: ftpError
        }
    });
});

app.get('/config', (req, res) => {
    res.json({
        ftpHost: config.ftpHost,
        ftpPort: config.ftpPort,
        ftpUser: config.ftpUser,
        ftpPass: '***',
        httpPort: config.httpPort
    });
});

app.post('/config', (req, res) => {
    const { ftpHost, ftpPort, ftpUser, ftpPass, httpPort } = req.body;
    if (ftpHost) config.ftpHost = ftpHost;
    if (ftpPort) config.ftpPort = parseInt(ftpPort);
    if (ftpUser) config.ftpUser = ftpUser;
    if (ftpPass && ftpPass !== '***') config.ftpPass = ftpPass;
    if (httpPort) config.httpPort = parseInt(httpPort);

    try {
        const saveConfig = { ...config };
        fs.writeFileSync(configPath, JSON.stringify(saveConfig, null, 2));
    } catch (e) {
        console.error('[Bridge] Failed to save config:', e.message);
    }

    res.json({ success: true, message: 'Config updated' });
});

app.get('/list', async (req, res) => {
    const reqPath = normalizePath(req.query.path || '/');
    let client;
    try {
        client = await getFtpClient();
        await cdToPath(client, reqPath);
        const list = await client.list();
        const items = list
            .filter(item => item.name !== '.' && item.name !== '..')
            .map(item => {
                const cleanName = path.basename(item.name.replace(/\\/g, '/'));
                return {
                    name: cleanName,
                    size: item.size || 0,
                    attributes: item.type === ftp.FileType.Directory ? 16 : 0,
                    type: item.type === ftp.FileType.Directory ? 'directory' : 'file',
                    date: item.rawModifiedAt || item.modifiedAt || null
                };
            });
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (client) client.close();
    }
});

app.get('/download', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    const transferId = String(++transferIdCounter);
    let client;
    try {
        client = await getFtpClient();

        let fileSize = 0;
        try {
            fileSize = await client.size(reqPath);
        } catch (e) { }

        transfers[transferId] = {
            type: 'download',
            path: reqPath,
            totalBytes: fileSize,
            transferredBytes: 0,
            percentage: 0,
            speed: 0,
            status: 'active',
            startTime: Date.now()
        };

        const fileName = path.basename(reqPath);
        res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(fileName) + '"');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('X-Transfer-Id', transferId);
        if (fileSize > 0) {
            res.setHeader('Content-Length', fileSize);
        }

        const passthrough = new PassThrough();
        let transferred = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        passthrough.on('data', (chunk) => {
            transferred += chunk.length;
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.5) {
                const speed = (transferred - lastBytes) / elapsed;
                lastTime = now;
                lastBytes = transferred;
                if (transfers[transferId]) {
                    transfers[transferId].transferredBytes = transferred;
                    transfers[transferId].percentage = fileSize > 0 ? Math.round((transferred / fileSize) * 100) : 0;
                    transfers[transferId].speed = Math.round(speed);
                }
            }
        });

        passthrough.on('end', () => {
            if (transfers[transferId]) {
                transfers[transferId].status = 'completed';
                transfers[transferId].transferredBytes = transferred;
                transfers[transferId].percentage = 100;
            }
            setTimeout(() => { delete transfers[transferId]; }, 30000);
        });

        passthrough.pipe(res);

        const dirPath = path.dirname(reqPath);
        await cdToPath(client, dirPath);
        await client.downloadTo(passthrough, fileName);
        client.close();
    } catch (e) {
        if (transfers[transferId]) {
            transfers[transferId].status = 'error';
            transfers[transferId].error = e.message;
        }
        if (client) client.close();
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        }
    }
});

app.post('/upload', upload.array('files'), async (req, res) => {
    const destPath = normalizePath(req.query.path || '/');
    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
    }

    const transferId = String(++transferIdCounter);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    transfers[transferId] = {
        type: 'upload',
        path: destPath,
        totalBytes: totalSize,
        transferredBytes: 0,
        percentage: 0,
        speed: 0,
        status: 'active',
        filesTotal: files.length,
        filesCompleted: 0,
        currentFile: '',
        startTime: Date.now()
    };

    res.json({ success: true, transferId, filesCount: files.length });

    let client;
    try {
        client = await getFtpClient();
        let overallTransferred = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const remotePath = destPath.replace(/\/$/, '') + '/' + file.originalname;
            transfers[transferId].currentFile = file.originalname;

            const readable = fs.createReadStream(file.path);
            let lastTime = Date.now();
            let lastBytes = overallTransferred;

            const trackStream = new Transform({
                transform(chunk, encoding, callback) {
                    overallTransferred += chunk.length;
                    const now = Date.now();
                    const elapsed = (now - lastTime) / 1000;
                    if (elapsed >= 0.5) {
                        const speed = (overallTransferred - lastBytes) / elapsed;
                        lastTime = now;
                        lastBytes = overallTransferred;
                        if (transfers[transferId]) {
                            transfers[transferId].transferredBytes = overallTransferred;
                            transfers[transferId].percentage = totalSize > 0 ? Math.round((overallTransferred / totalSize) * 100) : 0;
                            transfers[transferId].speed = Math.round(speed);
                        }
                    }
                    callback(null, chunk);
                }
            });

            const fileName = path.basename(file.originalname);
            await cdToPath(client, destPath);
            await client.uploadFrom(readable.pipe(trackStream), fileName);

            if (transfers[transferId]) {
                transfers[transferId].filesCompleted = i + 1;
            }

            try { fs.unlinkSync(file.path); } catch (e) { }
        }

        if (transfers[transferId]) {
            transfers[transferId].status = 'completed';
            transfers[transferId].percentage = 100;
            transfers[transferId].transferredBytes = totalSize;
        }
        client.close();
    } catch (e) {
        if (transfers[transferId]) {
            transfers[transferId].status = 'error';
            transfers[transferId].error = e.message;
        }
        if (client) client.close();
        for (const file of files) {
            try { fs.unlinkSync(file.path); } catch (ex) { }
        }
    }

    setTimeout(() => { delete transfers[transferId]; }, 60000);
});

app.get('/readfile', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    let client;
    try {
        client = await getFtpClient();

        let fileSize = 0;
        try {
            fileSize = await client.size(reqPath);
        } catch (e) { }

        if (fileSize > 2 * 1024 * 1024) {
            client.close();
            return res.status(400).json({ error: 'File too large to read as text (max 2MB)' });
        }

        const chunks = [];
        const passthrough = new PassThrough();
        passthrough.on('data', (chunk) => { chunks.push(chunk); });

        const done = new Promise((resolve, reject) => {
            passthrough.on('end', resolve);
            passthrough.on('error', reject);
        });

        const fileName = path.basename(reqPath);
        const dirPath = path.dirname(reqPath);
        await cdToPath(client, dirPath);
        await client.downloadTo(passthrough, fileName);
        await done;

        client.close();
        const fullBuf = Buffer.concat(chunks);
        res.json({ content: fullBuf.toString('utf8'), size: fullBuf.length });

    } catch (e) {
        if (client) client.close();
        res.status(500).json({ error: e.message });
    }
});

app.post('/writefile', express.json({ limit: '2mb' }), async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }
    if (!req.body || typeof req.body.content !== 'string') {
        return res.status(400).json({ error: 'Content is required' });
    }

    let client;
    try {
        client = await getFtpClient();

        const fileData = Buffer.from(req.body.content, 'utf8');
        const readable = new Readable();
        readable.push(fileData);
        readable.push(null);

        const fileName = path.basename(reqPath);
        const dirPath = path.dirname(reqPath);
        await cdToPath(client, dirPath);
        await client.uploadFrom(readable, fileName);

        client.close();
        res.json({ success: true, size: fileData.length });

    } catch (e) {
        if (client) client.close();
        res.status(500).json({ error: e.message });
    }
});

app.delete('/delete', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    let client;
    try {
        client = await getFtpClient();
        const isDir = req.query.type === 'directory';
        const fileName = path.basename(reqPath);
        const dirPath = path.dirname(reqPath);
        await cdToPath(client, dirPath);
        if (isDir) {
            await client.removeDir(fileName);
        } else {
            await client.remove(fileName);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (client) client.close();
    }
});

app.post('/move', async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) {
        return res.status(400).json({ error: 'from and to paths are required' });
    }

    let client;
    try {
        client = await getFtpClient();
        const fromPath = normalizePath(from);
        const toPath = normalizePath(to);
        const fromName = path.basename(fromPath);
        const fromDir = path.dirname(fromPath);

        await cdToPath(client, fromDir);
        await client.rename(fromName, toPath);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (client) client.close();
    }
});

app.post('/mkdir', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    let client;
    try {
        client = await getFtpClient();
        const dirPath = path.dirname(reqPath);
        const newDir = path.basename(reqPath);
        await cdToPath(client, dirPath);
        await client.ensureDir(newDir);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (client) client.close();
    }
});

app.get('/transfer-progress/:id', (req, res) => {
    const transfer = transfers[req.params.id];
    if (!transfer) {
        return res.status(404).json({ error: 'Transfer not found' });
    }
    const elapsed = (Date.now() - transfer.startTime) / 1000;
    let eta = 0;
    if (transfer.percentage > 0 && transfer.percentage < 100) {
        eta = Math.round(elapsed * (100 - transfer.percentage) / transfer.percentage);
    }
    res.json({ ...transfer, eta });
});

app.get('/transfers', (req, res) => {
    const active = Object.entries(transfers).map(([id, t]) => ({ id, ...t }));
    res.json(active);
});

const uploadsDir = path.join(__dirname, '.uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function startServer() {
    const server = app.listen(config.httpPort, '0.0.0.0', () => {
        console.log('');
        console.log('  ╔══════════════════════════════════════════╗');
        console.log('  ║       GODSend FTP Bridge v1.0.0          ║');
        console.log('  ╠══════════════════════════════════════════╣');
        console.log('  ║  HTTP Server: http://0.0.0.0:' + config.httpPort + '        ║');
        console.log('  ║  FTP Target:  ' + config.ftpHost + ':' + config.ftpPort + ('                ').substring(0, 16 - (config.ftpHost + ':' + config.ftpPort).length) + '║');
        console.log('  ║  FTP User:    ' + config.ftpUser + ('                ').substring(0, 16 - config.ftpUser.length) + '║');
        console.log('  ╚══════════════════════════════════════════╝');
        console.log('');
        console.log('  Bridge is ready. Open Nova WebUI to manage files.');
        console.log('  You can also configure FTP settings from the WebUI wizard.');
        console.log('  Press Ctrl+C to stop.');
        console.log('');
    });

    process.on('SIGINT', () => {
        console.log('\n[Bridge] Shutting down...');
        server.close();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n[Bridge] Shutting down...');
        server.close();
        process.exit(0);
    });
}

function interactiveSetup() {
    if (!process.stdin.isTTY) {
        startServer();
        return;
    }

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log('  ╔════════════════════════════════════════════╗');
    console.log('  ║       GODSend FTP Bridge - SETUP           ║');
    console.log('  ╚════════════════════════════════════════════╝');
    console.log('  Current FTP Target: ' + config.ftpHost + ':' + config.ftpPort);
    console.log('  Press Enter to use defaults or type new values.');
    console.log('  Waiting 10 seconds before auto-starting...');
    console.log('');

    let timeout = setTimeout(() => {
        console.log('\n  [Setup] No input detected. Auto-starting with current config...');
        rl.close();
        startServer();
    }, 10000);

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    async function runSetup() {
        process.stdin.once('data', () => {
            clearTimeout(timeout);
        });

        const host = await question('  Xbox IP address [' + config.ftpHost + ']: ');
        if (host.trim()) config.ftpHost = host.trim();

        const port = await question('  FTP Port [' + config.ftpPort + ']: ');
        if (port.trim()) config.ftpPort = parseInt(port.trim()) || config.ftpPort;

        const user = await question('  FTP Username [' + config.ftpUser + ']: ');
        if (user.trim()) config.ftpUser = user.trim();

        const pass = await question('  FTP Password [' + config.ftpPass + ']: ');
        if (pass.trim()) config.ftpPass = pass.trim();

        const hp = await question('  HTTP Port [' + config.httpPort + ']: ');
        if (hp.trim()) config.httpPort = parseInt(hp.trim()) || config.httpPort;

        rl.close();

        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('  [Setup] Config saved successfully.');
        } catch (e) {
            console.error('  [Setup] Warning: Could not save config file:', e.message);
        }

        startServer();
    }

    runSetup().catch(err => {
        console.error('  [Setup] Error during interactive setup:', err);
        startServer();
    });
}

interactiveSetup();

