//importing modules
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('./store.js');

// Store class
const store = new Store({
    configName: 'storage',
    defaults: {
        text: "Write something!",
    }
});

//Save & load
function handleSave(event, key = "text", content){
    store.set(key, content);
}
function handleLoad(event, key = "text") {
    return store.get(key);
}

//function for creating a window that renders 'index.html'
const createWindow = () => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
    },
    width: 800,
    height: 600
  });

  win.loadFile('index.html');
}

//run the createWindow function on startup
app.whenReady().then(() => {

  // listen for save event
  ipcMain.on('store:save', handleSave);
  // listen and respond for load event
  ipcMain.handle('store:load', handleLoad);

  createWindow();
})
