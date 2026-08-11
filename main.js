'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_ID = 'br.com.wtec.gcodestudio';

app.setAppUserModelId(APP_ID);

// Mantém aceleração por GPU/WebGL habilitada (padrão do Chromium).
// Não usamos --disable-gpu nem flags experimentais.

function createWindow() {
  const win = new BrowserWindow({
    title: 'G-Code Studio — Wtec Sistemas',
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#121518',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: true,
      spellcheck: false
    }
  });

  // O aplicativo é local e não depende de servidor ou CDN.
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // O relatório do próprio app usa window.open('about:blank').
  // Permitimos somente essa janela interna; URLs externas vão para
  // o navegador padrão do sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith('blob:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    }

    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  // Impede que a janela principal seja navegada para fora do app.
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();

    if (url !== current && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // F12 fica disponível para diagnóstico quando você precisar.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  return win;
}

app.whenReady().then(() => {
  // Remove o menu padrão do Electron.
  Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
