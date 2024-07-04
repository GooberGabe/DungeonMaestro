const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // You can add functions here to expose to the renderer process
});