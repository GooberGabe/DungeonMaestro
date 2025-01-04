const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveScene: (scene) => ipcRenderer.invoke('save-scene', scene),
    saveSound: (sound) => ipcRenderer.invoke('save-sound', sound),
    saveAsset: (asset) => ipcRenderer.invoke('save-asset', asset),
    saveQueue: (queue) => ipcRenderer.invoke('save-queue', queue),
    getScenes: () => ipcRenderer.invoke('get-scenes'),
    getSounds: () => ipcRenderer.invoke('get-sounds'),
    getAssets: () => ipcRenderer.invoke('get-assets'),
    getQueue: () => ipcRenderer.invoke('get-queue'),
    
    updateSceneOrder: (sceneIds) => ipcRenderer.invoke('update-scene-order', sceneIds),
    updateSoundName: (soundId, newName) => ipcRenderer.invoke('update-sound-name', soundId, newName),
    updateSoundVolume: (soundId, newVolume) => ipcRenderer.invoke('update-sound-volume', soundId, newVolume),
    updateSoundSource: (soundId, newSource) => ipcRenderer.invoke('update-sound-source', soundId, newSource),

    deleteScene: (sceneId) => ipcRenderer.invoke('delete-scene', sceneId),
    deleteSound: (soundId) => ipcRenderer.invoke('delete-sound', soundId),
    deleteAllScenes: () => ipcRenderer.invoke('delete-all-scenes'),
    deleteAsset: (assetId) => ipcRenderer.invoke('delete-asset', assetId),

    onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
    restartApp: () => ipcRenderer.send('restart_app'),
    uninstallApp: () => ipcRenderer.send('uninstall-app'),
    resizeWindow: (size) => ipcRenderer.send('resize-window', size),

    minimizeApp: () => {ipcRenderer.send('minimize-app')}
});