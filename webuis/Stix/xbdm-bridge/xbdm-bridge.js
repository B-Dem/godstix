const express = require('express');
const cors = require('cors');
const multer = require('multer');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { Transform } = require('stream');

let config = {
    httpPort: 7861,
    xbdmHost: '192.168.2.103',
    xbdmPort: 730
};

const configPath = path.join(__dirname, 'xbdm-bridge-config.json');
if (fs.existsSync(configPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        Object.assign(config, loaded);
        console.log('[XBDM Bridge] Loaded config from xbdm-bridge-config.json');
    } catch (e) {
        console.error('[XBDM Bridge] Error reading config:', e.message);
    }
}

if (process.env.XBDM_HOST) config.xbdmHost = process.env.XBDM_HOST;
if (process.env.XBDM_PORT) config.xbdmPort = parseInt(process.env.XBDM_PORT);
if (process.env.HTTP_PORT) config.httpPort = parseInt(process.env.HTTP_PORT);

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: false
}));
app.options('*', cors());
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

function toXbdmPath(p) {
    let normalized = normalizePath(p);
    if (normalized.startsWith('/')) normalized = normalized.substring(1);
    if (!normalized) return '';
    let parts = normalized.split('/');
    let drive = parts[0];
    if (drive && drive.endsWith(':')) {
        // already has colon (e.g. "Hdd1:" from Windows-style path)
    } else if (drive) {
        drive += ':';
    }
    let rest = parts.slice(1).join('\\');
    return rest ? drive + '\\' + rest : drive + '\\';
}

function fromXbdmPath(xp) {
    let p = xp.replace(/\\/g, '/');
    let colonIdx = p.indexOf(':');
    if (colonIdx > 0) {
        p = p.substring(0, colonIdx) + p.substring(colonIdx + 1);
    }
    if (!p.startsWith('/')) p = '/' + p;
    return p;
}

function xbdmConnect() {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(15000);

        let buffer = '';
        let connected = false;

        socket.connect(config.xbdmPort, config.xbdmHost, () => {});

        const onData = (data) => {
            buffer += data.toString();
            if (buffer.includes('\r\n') && !connected) {
                connected = true;
                socket.removeListener('data', onData);
                if (buffer.startsWith('201') || buffer.startsWith('200')) {
                    resolve(socket);
                } else {
                    socket.destroy();
                    reject(new Error('XBDM handshake failed: ' + buffer.trim()));
                }
            }
        };

        socket.on('data', onData);
        socket.on('error', (err) => reject(new Error('XBDM connection failed: ' + err.message)));
        socket.on('timeout', () => { socket.destroy(); reject(new Error('XBDM connection timed out')); });
    });
}

const XBDM_DESTRUCTIVE_CMDS = ['reboot', 'halt', 'shutdown', 'magicboot'];

function xbdmSendCommand(socket, command) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        let resolved = false;
        const cmdName = command.split(/\s/)[0].toLowerCase();
        const isDestructive = XBDM_DESTRUCTIVE_CMDS.indexOf(cmdName) !== -1;

        function finish(result) {
            if (resolved) return;
            resolved = true;
            socket.removeListener('data', onData);
            socket.removeListener('error', onError);
            socket.removeListener('close', onClose);
            resolve(result);
        }

        const onData = (data) => {
            buffer += data.toString();
            const lines = buffer.split('\r\n');
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                const code = parseInt(line.substring(0, 3));
                if (!isNaN(code)) {
                    finish({ code, message: line.substring(4), raw: buffer });
                    return;
                }
            }
        };

        const onError = (err) => {
            if (isDestructive) {
                finish({ code: 200, message: 'ok (connection closed)', raw: buffer });
            } else {
                finish({ code: 0, message: 'error: ' + (err ? err.message : 'connection lost'), raw: buffer });
            }
        };

        const onClose = () => {
            if (isDestructive) {
                finish({ code: 200, message: 'ok (connection closed)', raw: buffer });
            } else {
                finish({ code: 0, message: buffer.trim() || 'connection closed', raw: buffer });
            }
        };

        socket.on('data', onData);
        socket.on('error', onError);
        socket.on('close', onClose);
        socket.write(command + '\r\n');

        setTimeout(() => {
            finish({ code: 0, message: buffer.trim(), raw: buffer });
        }, 8000);
    });
}

function xbdmSendMultilineCommand(socket, command) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        const lines = [];

        const onData = (data) => {
            buffer += data.toString();
            const parts = buffer.split('\r\n');
            buffer = parts.pop();

            for (const part of parts) {
                if (part === '.') {
                    socket.removeListener('data', onData);
                    resolve(lines);
                    return;
                }
                lines.push(part);
            }
        };

        socket.on('data', onData);
        socket.write(command + '\r\n');

        setTimeout(() => {
            socket.removeListener('data', onData);
            resolve(lines);
        }, 15000);
    });
}

function parseXbdmDirEntry(line) {
    const entry = {};
    const regex = /(\w+)=("([^"]*)"|(\S+))/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[3] !== undefined ? match[3] : match[4];
        entry[key] = value;
    }
    return entry;
}

app.get('/status', async (req, res) => {
    let xbdmOk = false;
    let xbdmError = null;
    try {
        const socket = await xbdmConnect();
        xbdmOk = true;
        socket.destroy();
    } catch (e) {
        xbdmError = e.message;
    }
    res.json({
        status: 'ok',
        type: 'godsend-xbdm-bridge',
        version: '1.0.0',
        xbdm: {
            connected: xbdmOk,
            host: config.xbdmHost,
            port: config.xbdmPort,
            error: xbdmError
        }
    });
});

app.get('/config', (req, res) => {
    res.json({
        xbdmHost: config.xbdmHost,
        xbdmPort: config.xbdmPort,
        httpPort: config.httpPort
    });
});

app.post('/config', (req, res) => {
    const { xbdmHost, xbdmPort, httpPort } = req.body;
    if (xbdmHost) config.xbdmHost = xbdmHost;
    if (xbdmPort) config.xbdmPort = parseInt(xbdmPort);
    if (httpPort) config.httpPort = parseInt(httpPort);

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('[XBDM Bridge] Failed to save config:', e.message);
    }

    res.json({ success: true, message: 'Config updated' });
});

app.post('/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    let socket;
    try {
        socket = await xbdmConnect();
        const result = await xbdmSendCommand(socket, command);
        socket.destroy();
        res.json({ success: true, code: result.code, message: result.message });
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.get('/drives', async (req, res) => {
    let socket;
    try {
        socket = await xbdmConnect();
        const lines = await xbdmSendMultilineCommand(socket, 'drivelist');
        socket.destroy();

        const drives = [];
        for (const line of lines) {
            const code = parseInt(line.substring(0, 3));
            if (!isNaN(code) && code === 202) continue;
            const parsed = parseXbdmDirEntry(line);
            if (parsed.drivename) {
                drives.push({
                    name: parsed.drivename.replace(/[:\\]/g, ''),
                    label: parsed.drivename
                });
            }
        }
        res.json(drives);
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.get('/list', async (req, res) => {
    const reqPath = req.query.path || '/';
    const xbdmPath = toXbdmPath(reqPath);

    let socket;
    try {
        socket = await xbdmConnect();

        if (!xbdmPath || xbdmPath === '') {
            const lines = await xbdmSendMultilineCommand(socket, 'drivelist');
            socket.destroy();

            const items = [];
            for (const line of lines) {
                const code = parseInt(line.substring(0, 3));
                if (!isNaN(code)) continue;
                const trimmed = line.trim();
                if (!trimmed) continue;
                const parsed = parseXbdmDirEntry(trimmed);
                let driveName = parsed.drivename || trimmed;
                driveName = driveName.replace(/[:\\/]/g, '');
                if (!driveName) continue;
                items.push({
                    name: driveName,
                    size: 0,
                    attributes: 16,
                    type: 'directory',
                    date: null
                });
            }
            return res.json(items);
        }

        const lines = await xbdmSendMultilineCommand(socket, 'dirlist name="' + xbdmPath + '"');
        socket.destroy();

        const items = [];
        for (const line of lines) {
            const code = parseInt(line.substring(0, 3));
            if (!isNaN(code)) continue;

            const parsed = parseXbdmDirEntry(line);
            if (!parsed.name) continue;

            const tokens = line.trim().split(/\s+/);
            const isDir = tokens.indexOf('directory') !== -1;

            items.push({
                name: parsed.name,
                size: parsed.sizehi != null && parsed.sizelo != null
                    ? (parseInt(parsed.sizehi) * 4294967296 + parseInt(parsed.sizelo))
                    : 0,
                attributes: isDir ? 16 : 0,
                type: isDir ? 'directory' : 'file',
                date: parsed.createhi ? new Date(
                    (parseInt(parsed.createhi) * 4294967296 + parseInt(parsed.createlo || 0) - 116444736000000000) / 10000
                ).toISOString() : null
            });
        }

        res.json(items);
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.get('/download', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    const xbdmPath = toXbdmPath(reqPath);
    const transferId = String(++transferIdCounter);
    let socket;

    try {
        socket = await xbdmConnect();

        const sizeResult = await xbdmSendCommand(socket, 'getfileattributes name="' + xbdmPath + '"');
        let fileSize = 0;
        if (sizeResult.code === 200 || sizeResult.message) {
            const parsed = parseXbdmDirEntry(sizeResult.message);
            if (parsed.sizehi != null && parsed.sizelo != null) {
                fileSize = parseInt(parsed.sizehi) * 4294967296 + parseInt(parsed.sizelo);
            }
        }

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
        if (fileSize > 0) res.setHeader('Content-Length', fileSize);

        const chunkSize = 16384;
        let offset = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        while (offset < fileSize || fileSize === 0) {
            const readSize = Math.min(chunkSize, fileSize - offset || chunkSize);

            const getResult = await new Promise((resolve, reject) => {
                let buf = Buffer.alloc(0);
                let headerDone = false;
                let expectedLen = 0;
                let headerBuf = '';

                const onData = (data) => {
                    if (!headerDone) {
                        headerBuf += data.toString('binary');
                        const idx = headerBuf.indexOf('\r\n');
                        if (idx !== -1) {
                            const headerLine = headerBuf.substring(0, idx);
                            const code = parseInt(headerLine.substring(0, 3));
                            if (code !== 203) {
                                socket.removeListener('data', onData);
                                resolve({ error: headerLine });
                                return;
                            }
                            const sizeMatch = headerLine.match(/size=(\d+)/);
                            expectedLen = sizeMatch ? parseInt(sizeMatch[1]) : readSize;
                            const remaining = Buffer.from(headerBuf.substring(idx + 2), 'binary');
                            buf = remaining;
                            headerDone = true;
                            if (buf.length >= expectedLen) {
                                socket.removeListener('data', onData);
                                resolve({ data: buf.slice(0, expectedLen), size: expectedLen });
                            }
                        }
                    } else {
                        buf = Buffer.concat([buf, data]);
                        if (buf.length >= expectedLen) {
                            socket.removeListener('data', onData);
                            resolve({ data: buf.slice(0, expectedLen), size: expectedLen });
                        }
                    }
                };

                socket.on('data', onData);
                socket.write('getfile name="' + xbdmPath + '" offset=' + offset + ' size=' + readSize + '\r\n');

                setTimeout(() => {
                    socket.removeListener('data', onData);
                    if (buf.length > 0) {
                        resolve({ data: buf, size: buf.length });
                    } else {
                        resolve({ error: 'Timeout reading file' });
                    }
                }, 30000);
            });

            if (getResult.error) {
                if (offset > 0 && fileSize === 0) break;
                throw new Error(getResult.error);
            }

            res.write(getResult.data);
            offset += getResult.size;

            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.5) {
                const speed = (offset - lastBytes) / elapsed;
                lastTime = now;
                lastBytes = offset;
                if (transfers[transferId]) {
                    transfers[transferId].transferredBytes = offset;
                    transfers[transferId].percentage = fileSize > 0 ? Math.round((offset / fileSize) * 100) : 0;
                    transfers[transferId].speed = Math.round(speed);
                }
            }

            if (getResult.size < readSize) break;
        }

        res.end();
        socket.destroy();

        if (transfers[transferId]) {
            transfers[transferId].status = 'completed';
            transfers[transferId].transferredBytes = offset;
            transfers[transferId].percentage = 100;
        }
        setTimeout(() => { delete transfers[transferId]; }, 30000);

    } catch (e) {
        if (transfers[transferId]) {
            transfers[transferId].status = 'error';
            transfers[transferId].error = e.message;
        }
        if (socket) socket.destroy();
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        } else {
            res.end();
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

    let socket;
    try {
        socket = await xbdmConnect();
        let overallTransferred = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const xbdmBase = toXbdmPath(destPath);
            if (!xbdmBase) {
                throw new Error('Invalid upload destination path');
            }
            const xbdmDest = xbdmBase.endsWith('\\') ? xbdmBase + file.originalname : xbdmBase + '\\' + file.originalname;
            transfers[transferId].currentFile = file.originalname;

            const fileData = fs.readFileSync(file.path);
            const fileSize = fileData.length;

            const sendResult = await new Promise((resolve, reject) => {
                let respBuf = '';
                const onData = (data) => {
                    respBuf += data.toString();
                    if (respBuf.includes('\r\n')) {
                        socket.removeListener('data', onData);
                        const code = parseInt(respBuf.substring(0, 3));
                        if (code === 204) {
                            socket.write(fileData, () => {
                                let ackBuf = '';
                                const onAck = (ackData) => {
                                    ackBuf += ackData.toString();
                                    if (ackBuf.includes('\r\n')) {
                                        socket.removeListener('data', onAck);
                                        const ackCode = parseInt(ackBuf.substring(0, 3));
                                        if (!isNaN(ackCode) && ackCode >= 400) {
                                            resolve({ error: 'XBDM error after transfer: ' + ackBuf.trim() });
                                        } else {
                                            resolve({ success: true });
                                        }
                                    }
                                };
                                socket.on('data', onAck);
                                setTimeout(() => {
                                    socket.removeListener('data', onAck);
                                    resolve({ success: true });
                                }, 10000);
                            });
                        } else {
                            resolve({ error: respBuf.trim() });
                        }
                    }
                };
                socket.on('data', onData);
                socket.write('sendfile name="' + xbdmDest + '" length=' + fileSize + '\r\n');

                setTimeout(() => {
                    socket.removeListener('data', onData);
                    resolve({ error: 'Upload timeout' });
                }, 60000);
            });

            if (sendResult.error) {
                throw new Error('Upload failed for ' + file.originalname + ': ' + sendResult.error);
            }

            overallTransferred += fileSize;
            if (transfers[transferId]) {
                transfers[transferId].filesCompleted = i + 1;
                transfers[transferId].transferredBytes = overallTransferred;
                transfers[transferId].percentage = totalSize > 0 ? Math.round((overallTransferred / totalSize) * 100) : 0;
            }

            try { fs.unlinkSync(file.path); } catch (e) { }
        }

        socket.destroy();

        if (transfers[transferId]) {
            transfers[transferId].status = 'completed';
            transfers[transferId].percentage = 100;
            transfers[transferId].transferredBytes = totalSize;
        }
    } catch (e) {
        if (transfers[transferId]) {
            transfers[transferId].status = 'error';
            transfers[transferId].error = e.message;
        }
        if (socket) socket.destroy();
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

    const xbdmPath = toXbdmPath(reqPath);
    let socket;

    try {
        socket = await xbdmConnect();

        const sizeResult = await xbdmSendCommand(socket, 'getfileattributes name="' + xbdmPath + '"');
        let fileSize = 0;
        if (sizeResult.code === 200 || sizeResult.message) {
            const parsed = parseXbdmDirEntry(sizeResult.message);
            if (parsed.sizehi != null && parsed.sizelo != null) {
                fileSize = parseInt(parsed.sizehi) * 4294967296 + parseInt(parsed.sizelo);
            }
        }

        if (fileSize > 2 * 1024 * 1024) {
            socket.destroy();
            return res.status(400).json({ error: 'File too large to read as text (max 2MB)' });
        }

        const chunkSize = 16384;
        let offset = 0;
        let allBufs = [];

        while (offset < fileSize || fileSize === 0) {
            const readSize = Math.min(chunkSize, fileSize - offset || chunkSize);

            const getResult = await new Promise((resolve, reject) => {
                let buf = Buffer.alloc(0);
                let headerDone = false;
                let expectedLen = 0;
                let headerBuf = '';

                const onData = (data) => {
                    if (!headerDone) {
                        headerBuf += data.toString('binary');
                        const idx = headerBuf.indexOf('\r\n');
                        if (idx !== -1) {
                            const headerLine = headerBuf.substring(0, idx);
                            const code = parseInt(headerLine.substring(0, 3));
                            if (code !== 203) {
                                socket.removeListener('data', onData);
                                resolve({ error: headerLine });
                                return;
                            }
                            const sizeMatch = headerLine.match(/size=(\d+)/);
                            expectedLen = sizeMatch ? parseInt(sizeMatch[1]) : readSize;
                            const remaining = Buffer.from(headerBuf.substring(idx + 2), 'binary');
                            buf = remaining;
                            headerDone = true;
                            if (buf.length >= expectedLen) {
                                socket.removeListener('data', onData);
                                resolve({ data: buf.slice(0, expectedLen), size: expectedLen });
                            }
                        }
                    } else {
                        buf = Buffer.concat([buf, data]);
                        if (buf.length >= expectedLen) {
                            socket.removeListener('data', onData);
                            resolve({ data: buf.slice(0, expectedLen), size: expectedLen });
                        }
                    }
                };

                socket.on('data', onData);
                socket.write('getfile name="' + xbdmPath + '" offset=' + offset + ' size=' + readSize + '\r\n');

                setTimeout(() => {
                    socket.removeListener('data', onData);
                    if (buf.length > 0) {
                        resolve({ data: buf, size: buf.length });
                    } else {
                        resolve({ error: 'Timeout reading file' });
                    }
                }, 30000);
            });

            if (getResult.error) {
                if (offset > 0 && fileSize === 0) break;
                throw new Error(getResult.error);
            }

            allBufs.push(getResult.data);
            offset += getResult.size;
            if (getResult.size < readSize) break;
        }

        socket.destroy();
        const fullBuf = Buffer.concat(allBufs);
        res.json({ content: fullBuf.toString('utf8'), size: fullBuf.length });

    } catch (e) {
        if (socket) socket.destroy();
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

    const xbdmPath = toXbdmPath(reqPath);
    const fileData = Buffer.from(req.body.content, 'utf8');
    const fileSize = fileData.length;
    let socket;

    try {
        socket = await xbdmConnect();

        const sendResult = await new Promise((resolve) => {
            let respBuf = '';
            const onData = (data) => {
                respBuf += data.toString();
                if (respBuf.includes('\r\n')) {
                    socket.removeListener('data', onData);
                    const code = parseInt(respBuf.substring(0, 3));
                    if (code === 204) {
                        socket.write(fileData, () => {
                            let ackBuf = '';
                            const onAck = (ackData) => {
                                ackBuf += ackData.toString();
                                if (ackBuf.includes('\r\n')) {
                                    socket.removeListener('data', onAck);
                                    const ackCode = parseInt(ackBuf.substring(0, 3));
                                    if (!isNaN(ackCode) && ackCode >= 400) {
                                        resolve({ error: 'XBDM error after transfer: ' + ackBuf.trim() });
                                    } else {
                                        resolve({ success: true });
                                    }
                                }
                            };
                            socket.on('data', onAck);
                            setTimeout(() => {
                                socket.removeListener('data', onAck);
                                resolve({ success: true });
                            }, 10000);
                        });
                    } else {
                        resolve({ error: respBuf.trim() });
                    }
                }
            };
            socket.on('data', onData);
            socket.write('sendfile name="' + xbdmPath + '" length=' + fileSize + '\r\n');

            setTimeout(() => {
                socket.removeListener('data', onData);
                resolve({ error: 'Write timeout' });
            }, 60000);
        });

        socket.destroy();

        if (sendResult.error) {
            return res.status(500).json({ error: sendResult.error });
        }

        res.json({ success: true, size: fileSize });

    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.delete('/delete', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    const xbdmPath = toXbdmPath(reqPath);
    const isDir = req.query.type === 'directory';
    let socket;

    try {
        socket = await xbdmConnect();
        const cmd = isDir ? 'dirlist name="' + xbdmPath + '"' : 'delete name="' + xbdmPath + '"';

        if (isDir) {
            const delResult = await xbdmSendCommand(socket, 'delete name="' + xbdmPath + '" dir');
            if (delResult.code !== 200) {
                throw new Error(delResult.message || 'Failed to delete directory');
            }
        } else {
            const delResult = await xbdmSendCommand(socket, 'delete name="' + xbdmPath + '"');
            if (delResult.code !== 200) {
                throw new Error(delResult.message || 'Failed to delete file');
            }
        }

        socket.destroy();
        res.json({ success: true });
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.post('/mkdir', async (req, res) => {
    const reqPath = normalizePath(req.query.path);
    if (!reqPath || reqPath === '/') {
        return res.status(400).json({ error: 'Path is required' });
    }

    const xbdmPath = toXbdmPath(reqPath);
    let socket;

    try {
        socket = await xbdmConnect();
        const result = await xbdmSendCommand(socket, 'mkdir name="' + xbdmPath + '"');
        socket.destroy();

        if (result.code !== 200) {
            throw new Error(result.message || 'Failed to create directory');
        }
        res.json({ success: true });
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
    }
});

app.post('/move', async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) {
        return res.status(400).json({ error: 'from and to paths are required' });
    }

    const fromXbdm = toXbdmPath(from);
    const toXbdm = toXbdmPath(to);
    let socket;

    try {
        socket = await xbdmConnect();
        const result = await xbdmSendCommand(socket, 'rename name="' + fromXbdm + '" newname="' + toXbdm + '"');
        socket.destroy();

        if (result.code !== 200) {
            throw new Error(result.message || 'Failed to rename');
        }
        res.json({ success: true });
    } catch (e) {
        if (socket) socket.destroy();
        res.status(500).json({ error: e.message });
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
        console.log('  ╔════════════════════════════════════════════╗');
        console.log('  ║       GODSend XBDM Bridge v1.0.0           ║');
        console.log('  ╠════════════════════════════════════════════╣');
        console.log('  ║  HTTP Server:  http://0.0.0.0:' + config.httpPort + '         ║');
        console.log('  ║  XBDM Target:  ' + config.xbdmHost + ':' + config.xbdmPort + ('               ').substring(0, 15 - (config.xbdmHost + ':' + config.xbdmPort).length) + '║');
        console.log('  ╚════════════════════════════════════════════╝');
        console.log('');
        console.log('  XBDM Bridge is ready. Open Nova WebUI to manage files.');
        console.log('  XBDM works even while games are running!');
        console.log('  Press Ctrl+C to stop.');
        console.log('');
    });

    process.on('SIGINT', () => {
        console.log('\n[XBDM Bridge] Shutting down...');
        server.close();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n[XBDM Bridge] Shutting down...');
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
    console.log('  ║       GODSend XBDM Bridge - SETUP          ║');
    console.log('  ╚════════════════════════════════════════════╝');
    console.log('  Current XBDM Target: ' + config.xbdmHost + ':' + config.xbdmPort);
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

        const host = await question('  Xbox IP address [' + config.xbdmHost + ']: ');
        if (host.trim()) config.xbdmHost = host.trim();

        const port = await question('  XBDM Port [' + config.xbdmPort + ']: ');
        if (port.trim()) config.xbdmPort = parseInt(port.trim()) || config.xbdmPort;

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

