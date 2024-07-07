const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveScene: (scene) => ipcRenderer.invoke('save-scene', scene),
    saveSound: (sound) => ipcRenderer.invoke('save-sound', sound),
    saveQueue: (queue) => ipcRenderer.invoke('save-queue', queue),
    getScenes: () => ipcRenderer.invoke('get-scenes'),
    getSounds: () => ipcRenderer.invoke('get-sounds'),
    getQueue: () => ipcRenderer.invoke('get-queue'),
    deleteAllScenes: () => ipcRenderer.invoke('delete-all-scenes')
});