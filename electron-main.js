// electron-main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const isDev = !app.isPackaged;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      // ✅ 더 이상 preload 사용하지 않음
      // preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'build', 'icon.ico'),
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(devURL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    // 🔍 빈 화면시 원인 확인을 위해 배포에서도 잠깐 DevTools를 열어보세요.
    // win.webContents.openDevTools();
  }

  // 진단용: 렌더러 에러/콘솔 로그 표면화
  win.webContents.on('did-fail-load', (_e, _code, desc, url) => {
    console.error('did-fail-load:', desc, url);
  });
  win.webContents.on('console-message', (_e, level, message) => {
    console.log('renderer:', message);
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
