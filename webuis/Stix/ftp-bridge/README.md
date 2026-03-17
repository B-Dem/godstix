# GODSend FTP Bridge

Bridge between Nova WebUI and Xbox 360 FTP server.

## Quick Start

1. Run: `npm install`
2. Run: `node bridge.js` (first run will ask for your Xbox IP, user, and password)
3. Open Nova WebUI > Files > Set Up FTP Bridge

You can also configure the FTP settings directly from the WebUI wizard after connecting to the bridge.

## Configuration

Settings are stored in `bridge-config.json` (created automatically on first run):
- `ftpHost`: Xbox 360 IP address (default: 192.168.1.100)
- `ftpPort`: FTP port (default: 21)
- `ftpUser`: FTP username (default: xboxftp)
- `ftpPass`: FTP password (default: xboxftp)
- `httpPort`: Bridge HTTP port (default: 7860)

## Termux (Android)

```
pkg install nodejs
cd godsend-ftp-bridge
npm install
node bridge.js
```
