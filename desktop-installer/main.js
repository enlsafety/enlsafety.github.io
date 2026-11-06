'use strict';
// Separate Windows app shell; the actual web app and production data remain unchanged.
const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');
const APP_URL = 'https://enlsafety.github.io/';
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_ID = 'kr.co.enl.safety.desktop';
const SESSION_NAME = 'persist:enl-safety';
function isAppUrl(input) {
  try { const url = new URL(input); return url.protocol === 'https:' && url.origin === APP_ORIGIN; }
  catch (_) { return false; }
}
function isPopupUrl(input) {
  return isAppUrl(input) || input === 'about:blank' || input.startsWith('blob:' + APP_ORIGIN + '/');
}
function openExternal(input) {
  try {
    const url = new URL(input);
    if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
      shell.openExternal(url.toString()).catch(() => {});
    }
  } catch (_) {}
}
let mainWindow = null;
function configureSession(ses) {
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const requestUrl = (details && details.requestingUrl) || (wc && wc.getURL()) || '';
    callback(permission === 'notifications' && isAppUrl(requestUrl));
  });
  ses.setPermissionCheckHandler((wc, permission, origin) =>
    permission === 'notifications' && isAppUrl(origin || (wc && wc.getURL()) || '')
  );
}
function createWindow() {
  mainWindow = new BrowserWindow({
    title: '이앤엘 안전보건관리시스템',
    width: 1460, height: 920, minWidth: 850, minHeight: 600,
    show: false, autoHideMenuBar: true, backgroundColor: '#eef7fd',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, partition: SESSION_NAME }
  });
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isPopupUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, partition: SESSION_NAME }
      }};
    }
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || !isAppUrl(validatedURL)) return;
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
      mainWindow.show();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL).catch(() => {});
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.setAppUserModelId(APP_ID);
  app.whenReady().then(() => {
    configureSession(session.fromPartition(SESSION_NAME));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
