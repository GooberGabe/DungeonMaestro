const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const SoundboardDB = require('./database.js');

let mainWindow;
let db;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 300,
    height: 200,
    x: width - 320,
    y: height - 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    icon: path.join(__dirname, 'assets/logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.setResizable(true);
  win.setMinimumSize(200, 100); 

  win.webContents.once('did-finish-load', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  //win.on('closed', function () {
  //  mainWindow = null;
  //});

  // Uncomment to open DevTools by default
  // win.webContents.openDevTools();
}

// Database handler stuff

async function initializeDatabase() {
  db = new SoundboardDB();
  await db.initDatabase(); // Must exist in SoundboardDB class
}

function setupIPCHandlers() {
  ipcMain.handle('save-scene', async (event, scene) => await db.saveScene(scene));
  ipcMain.handle('save-sound', async (event, sound) => await db.saveSound(sound));
  ipcMain.handle('save-queue', async (event, queue) => await db.saveQueue(queue));
  ipcMain.handle('get-scenes', async () => await db.getScenes());
  ipcMain.handle('get-sounds', async () => await db.getSounds());
  ipcMain.handle('get-queue', async () => await db.getQueue());
  ipcMain.handle('update-scene-order', async (event, sceneIds) => {
    await db.updateSceneOrder(sceneIds);
  });
  ipcMain.handle('delete-scene', async (event, sceneId) => {
    if (!db) {
        throw new Error('Database not initialized');
    }
    try {
        await db.deleteScene(sceneId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting scene:', error);
        return { success: false, error: error.message };
    }
  });
  ipcMain.handle('delete-sound', async (event, soundId) => { await db.deleteSound(soundId); });

  ipcMain.handle('delete-all-scenes', async () => {
    await db.deleteAllScenes();
    console.log('All scenes deleted from database');
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
  setupIPCHandlers();
  createWindow();

  app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

// This will delete stuff from appdata but won't remove the executable
async function uninstallApp() {
  const userDataPath = app.getPath('userData');
  const choice = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Yes', 'No'],
    title: 'Confirm Uninstall',
    message: 'Are you sure you want to uninstall? This will delete all app data.'
  });

  if (choice.response === 0) { // 'Yes'
    try {
      await fs.rm(userDataPath, { recursive: true, force: true });
      await dialog.showMessageBox({
        type: 'info',
        title: 'Uninstall Complete',
        message: 'The application has been uninstalled. You can now delete the executable file.'
      });
      app.quit();
    } catch (err) {
      console.error('Uninstall error:', err);
      await dialog.showMessageBox({
        type: 'error',
        title: 'Uninstall Error',
        message: 'An error occurred during uninstall. Please try manually deleting the app data.'
      });
    }
  }
}

// Add IPC handler for uninstall
ipcMain.on('uninstall-app', uninstallApp);