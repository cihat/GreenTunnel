const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeImage } = require('electron');
const windowStateKeeper = require('electron-window-state');
const debug = /--debug/.test(process.argv[2]);
const { Proxy } = require('green-tunnel');
const path = require('path');
const os = require('os');

// Disable any dialog box
const electron = require('electron');
const dialog = electron.dialog;
dialog.showErrorBox = function (title, content) {
  console.log(`${title}\n${content}`);
};

// Handle Squirrel events for Windows installer
const setupEvents = require('./installers/windows/setupEvents');
if (setupEvents.handleSquirrelEvent()) {
  return;
}

let win, tray, proxy;
let isOn = false;

const menuItems = [
  {
    label: 'Turn Off',
    type: 'normal',
    click: () => turnOff(),
  },
  {
    label: 'Run At Login',
    type: 'checkbox',
  },
  {
    type: 'separator',
  },
  {
    label: 'Source Code',
    type: 'normal',
    click: () => shell.openExternal('https://github.com/cihat/GreenTunnel'),
  },
  {
    role: 'quit',
    label: 'Quit',
    type: 'normal',
  },
];

async function turnOff() {
  isOn = false;

  if (proxy) {
    await proxy.stop();
    proxy = null;
  }

  if (win && !win.isDestroyed()) {
    win.webContents.send('changeStatus', isOn);
  }

  menuItems[0].label = 'Enable';
  menuItems[0].click = () => turnOn();
  tray.setContextMenu(Menu.buildFromTemplate(menuItems));

  const iconPath = path.join(__dirname, 'images/iconDisabledTemplate@2x.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray.setImage(trayIcon);
}

async function turnOn() {
  isOn = true;

  if (proxy) {
    await turnOff();
  }

  proxy = new Proxy({ source: 'GUI' });
  await proxy.start({ setProxy: true });

  if (win && !win.isDestroyed()) {
    win.webContents.send('changeStatus', isOn);
  }

  menuItems[0].label = 'Disable';
  menuItems[0].click = () => turnOff();
  tray.setContextMenu(Menu.buildFromTemplate(menuItems));

  const iconPath = path.join(__dirname, 'images/iconTemplate@2x.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray.setImage(trayIcon);
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icons/icon.icns');
  const appIcon = nativeImage.createFromPath(iconPath);

  const stateManager = windowStateKeeper();

  win = new BrowserWindow({
    width: 300,
    height: 300,
    x: stateManager.x,
    y: stateManager.y,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    resizable: false,
    icon: appIcon,
    show: false,

    title: 'Green Tunnel',
    frame: false,
    transparent: true,
    webPreferences: {
      // Keep original functionality - minimal changes for compatibility
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false
    }
  });

  // Save window state
  stateManager.manage(win);

  win.loadFile('./view/main-page/index.html');

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    turnOn();
  });

  win.on('closed', () => {
    win = null;
  });

  if (debug) {
    win.webContents.openDevTools();
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// app.on('activate', () => {
//   if (win === null) {
//     createWindow();
//   }
// });

app.whenReady().then(() => {
  if (false) {
    // createWindow();
  } else {
    turnOn();
  }
  const iconPath = path.join(__dirname, 'images/iconTemplate@2x.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  tray.setToolTip('Green Tunnel');
  tray.setContextMenu(Menu.buildFromTemplate(menuItems));

  // Restore the window on double click
  tray.on('double-click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });
})

app.on('before-quit', async (e) => {
  if (isOn) {
    e.preventDefault();
    await turnOff();
    app.quit();
  }
});

// Keep original IPC handlers - no changes to maintain compatibility
ipcMain.on('close-button', (event, arg) => {
  if (os.platform() === 'darwin') {
    app.hide();
  } else {
    win.hide();
  }
});

ipcMain.on('on-off-button', (event, arg) => {
  if (isOn) {
    turnOff();
  } else {
    turnOn();
  }
});

// Optional: Single instance enforcement (can be removed if not needed)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
