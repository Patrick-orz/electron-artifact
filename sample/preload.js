const { contextBridge, ipcRenderer } = require('electron')

window.ipcRenderer = ipcRenderer;

// Allows for save-load in vanilla js
contextBridge.exposeInMainWorld('store', {
  save: (key, content) => ipcRenderer.send('store:save', key, content),
  load: (key) => ipcRenderer.invoke('store:load', key),
})
