const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('path');
const { autoUpdater, AppUpdater } = require('electron-updater');
const SoundboardDB = require('./database.js');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

if (process.env.NODE_ENV === 'production') {
  // In production, use the bundled version
  require('./dist/bundle.js');
}
else 
{

let mainWindow;
let db;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 360,
    height: 320,
    x: (width / 2) - 180,
    y: (height / 2) - 160,
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
  mainWindow = win;

  win.loadFile('index.html');
  win.setResizable(true);
  win.setMinimumSize(200, 100); 

  win.webContents.on('did-finish-load', () => {
    if (process.env.NODE_ENV !== 'development') {
      //autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Uncomment to open DevTools by default
  // win.webContents.openDevTools();

  /* 
   mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('Renderer process gone:', details);
  });
  */
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
  ipcMain.handle('update-sound-name', async (event, soundId, newName) => {
    await db.updateSoundName(soundId, newName);
  });

  ipcMain.handle('update-sound-volume', async (event, soundId, newVolume) => {
      await db.updateSoundVolume(soundId, newVolume);
  });

  ipcMain.handle('update-sound-source', async (event, soundId, newSource) => {
      await db.updateSoundSource(soundId, newSource);
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

  ipcMain.on('resize-window', (event, size) => {
    if (mainWindow) {
        mainWindow.setSize(size.width, size.height);
    }
  });
  

}

app.whenReady().then(async () => {
  await initializeDatabase();
  setupIPCHandlers();
  createWindow();

  app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  autoUpdater.checkForUpdates();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

//#region  ---- Auto-updater events ----
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  mainWindow.webContents.send('update_available');
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
  log_message += ` - Downloaded ${progressObj.percent}%`;
  log_message += ` (${progressObj.transferred}/${progressObj.total})`;
  console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

//#endregion

async function minimize() {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.minimize();
  }
}

// This does not work. 
ipcMain.on('minimize-app', minimize);

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

}