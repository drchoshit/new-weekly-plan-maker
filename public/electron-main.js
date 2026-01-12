// electron-main.js
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = !app.isPackaged;

// 간단 MIME 테이블
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.map':  'application/octet-stream',
};

// dist 정적 서버
function serveDistOnce(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url || '/');
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        urlPath = path.posix.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(distDir, urlPath);

        const sendFile = (fp) => {
          fs.readFile(fp, (err, buf) => {
            if (err) {
              const indexPath = path.join(distDir, 'index.html');
              fs.readFile(indexPath, (err2, buf2) => {
                if (err2) {
                  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                  res.end('Not Found');
                } else {
                  res.writeHead(200, { 'Content-Type': MIME['.html'] });
                  res.end(buf2);
                }
              });
            } else {
              const ext = path.extname(fp).toLowerCase();
              res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
              res.end(buf);
            }
          });
        };

        fs.stat(filePath, (err, stat) => {
          if (!err && stat.isFile()) return sendFile(filePath);
          if (!err && stat.isDirectory()) return sendFile(path.join(filePath, 'index.html'));
          return sendFile(filePath);
        });
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
    },
    // BrowserWindow 아이콘은 생략(빌더가 exe 아이콘을 씀)
    // icon: path.join(__dirname, 'build', 'icon.ico'),
  });

  win.once('ready-to-show', () => win.show());

  // 실패/콘솔 로그
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url);
  });
  win.webContents.on('console-message', (_e, level, message) => {
    console.log('renderer:', message);
  });

  if (isDev) {
    const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(devURL);
    win.webContents.openDevTools();
  } else {
    const distDir = path.join(__dirname, 'dist');
    serveDistOnce(distDir).then(({ port }) => {
      const url = `http://127.0.0.1:${port}/`;
      console.log('[electron] serving dist at', url);
      win.loadURL(url);
    }).catch(err => {
      console.error('Failed to start internal server', err);
      const indexPath = path.join(distDir, 'index.html');
      win.loadFile(indexPath).catch(err2 => {
        console.error('Failed to load file:', indexPath, err2);
      });
    });
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
