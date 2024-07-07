const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.setResizable(true);
  win.setMinimumSize(200, 100); 

  //win.on('closed', function () {
  //  mainWindow = null;
  //});

  // Uncomment to open DevTools by defaults
  // win.webContents.openDevTools();
}

// Database handler stuff
console.log("TEST")

function setupIPCHandlers() {
  ipcMain.handle('save-scene', async (event, scene) => await db.saveScene(scene));
  ipcMain.handle('save-sound', async (event, sound) => await db.saveSound(sound));
  ipcMain.handle('save-queue', async (event, queue) => await db.saveQueue(queue));
  ipcMain.handle('get-scenes', async () => await db.getScenes());
  ipcMain.handle('get-sounds', async () => await db.getSounds());
  ipcMain.handle('get-queue', async () => await db.getQueue());

  ipcMain.handle('delete-all-scenes', async () => {
    await db.deleteAllScenes();
    console.log('All scenes deleted from database');
});
}

app.whenReady().then(async () => {
  db = new SoundboardDB();
  await db.dbPromise;
  setupIPCHandlers();
  createWindow();

  app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});