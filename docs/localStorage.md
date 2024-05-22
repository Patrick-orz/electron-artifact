# Local Storage

> Basic understanding of electron is expected before reading this page. Head to [setup](setup.md) first if unsure.

How to have your electron app save and access local files.

## Background Information

Storing information locally for access in different sessions is a basic yet crucial operation. This page would teach you how to create a sample that includes a textarea which saves on edit.

### Electron Processes

> More details on the electron process model could be found [here](https://www.electronjs.org/docs/latest/tutorial/process-model)

Before going into real implementation, there are some **logistics** to go over. This would be explained in simple so not the most precise terms.

#### ```Node.js``` Process

In an electron app, the entrance point, or ```main.js```, runs in the ```Node.js``` environment. ```Node.js``` allows for storing information locally, on the users machine. This would be where the actual storage logic resides.

#### Vanilla ```js``` Process

For each webpage (such as ```index.html```), you can link ```js``` files with it, just as you do with web-dev. These ```js``` files would function as you expect, in the vanilla js environment.

The issue here is, the ```Node.js``` process has no access to webpage information, while the vanilla ```js``` process has access to webpage content, but no access to the ```Node.js``` environment (which includes actions such as saving and loading).

This is where **Preload Scripts** come into play.

#### Preload Script

Preload scripts are ```js``` files ran in the vanilla ```js``` context, but has access to ```Node.js``` APIs. It is also executes before any web content loads.

This is very powerful, since preload scripts basically grant vanilla ```js``` processes the ability to call ```Node.js``` APIs, solving the mentioned issue.

### Roadmap

With the background information in mind, the follow is what we are going to do so our goal of saving and loading locally would be achieved.

- Create functions in the ```Node.js``` process that allows for saving and loading local files
- Make these functions callable in the vanilla ```js``` processes through preload scripts
- Add vanilla ```js``` logic that calls the save load functions when necessary

Let's get into it.

## Save Load Function

Implementing save & load functions in the ```Node.js``` process.

### Class

The following is a class defined in ```Node.js``` environment which allows for basic saving and loading:

```js
// From
// https://gist.github.com/ccnokes/95cb454860dbf8577e88d734c3f31e08#file-store-js
const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(opts) {
    // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
    // app.getPath('userData') will return a string of the user's app data directory path.
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
    this.path = path.join(userDataPath, opts.configName + '.json');
    
    this.data = parseDataFile(this.path, opts.defaults);
  }

  // This will just return the property on the `data` object
  get(key) {
    return this.data[key];
  }

  // ...and this will set it
  set(key, val) {
    this.data[key] = val;
    // Wait, I thought using the node.js' synchronous APIs was bad form?
    // We're not writing a server so there's not nearly the same IO demand on the process
    // Also if we used an async API and our app was quit before the asynchronous write had a chance to complete,
    // we might lose that data. Note that in a real app, we would try/catch this.
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  // We'll try/catch it in case the file doesn't exist yet, which will be the case on the first application run.
  // `fs.readFileSync` will return a JSON string which we then parse into a Javascript object
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    // if there was some kind of error, return the passed in defaults instead.
    return defaults;
  }
}

// expose the class
module.exports = Store;
```

Details of this piece of code can be seen in the comments or its [origin](https://gist.github.com/ccnokes/95cb454860dbf8577e88d734c3f31e08#file-store-js).

In general, this piece of code stores and loads a customized ```json``` file in the path ```app.getPath('userData')```. ```'userData'``` is, according to the [official electron doc](https://www.electronjs.org/docs/latest/api/app#appgetpathname):

> The directory for storing your app's configuration files, which by default is the ```appData``` directory appended with your app's name. By convention files storing user data should be written to this directory, and it is not recommended to write large files here because some environments may backup this directory to cloud storage.

The ```appData``` directory:

> Per-user application data directory, which by default points to:
> - %APPDATA% on Windows
> - $XDG_CONFIG_HOME or ~/.config on Linux
> - ~/Library/Application Support on macOS

Create a new file called ```store.js``` with the above piece of code. The file structure should look like this:

```
.
├── index.html
├── main.js
├── package-lock.json
├── package.json
└── store.js
```

### Wrap Into Function

Going back into ```main.js```, we are going to import the **Store** class from ```store.js``` then wrap it into a callable function.

Import **Store** class:
```js
const Store = require('./store.js');
```

Initialize an instance of **Store**:
```js
// Store class
const store = new Store({
    configName: 'storage',
    defaults: {
        text: "Write something!",
    }
})
```

Wrap into functions:
```js
//Save & load
function handleSave(event, key = "text", content){
    store.set(key, content);
}
function handleLoad(event, key = "text") {
    return store.get(key);
}
```

Your ```main.js``` should look something like this:
```js
//importing modules
const { app, BrowserWindow } = require('electron');
const Store = require('./store.js');

// Store class
const store = new Store({
    configName: 'storage',
    defaults: {
        text: "Write something!",
    }
})

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
    width: 800,
    height: 600
  });

  win.loadFile('index.html');
}

//run the createWindow function on startup
app.whenReady().then(() => {
  createWindow();
})
```

To test whether everything is correct, you can call the ```handleSave()``` function with placeholder arguments and check ```userData``` path for the file ```storage.json```.

For example, calling:
```js
handleSave("placeholderEvent", "text", "content");
```
right under ```createWindow()``` should provide us with a file called ```storage.json``` at ```userData```, containing the following:
```json
{"text":"content"}
```

Similar testing could be done with ```handleLoad()```

**Remember to comment out these lines when done testing!**

## Expose To Vanilla ```js```

The functions are up and working in the ```Node.js``` process, it's time to have them callable in vanilla ```js``` processes.

This would be done by communicating between ```main.js``` and the preload script through ```ipc```, or inter-process communication. The preload script would then expose the ```handleSave()``` and ```handleLoad()``` function to have them accessible for vanilla ```js``` processes.

> More on ipc could be read about [here](https://www.electronjs.org/docs/latest/tutorial/ipc)

### Setup Preload Script

Create a new file named ```preload.js```, this would be our preload script.

File structure should look like this:
```
.
├── index.html
├── main.js
├── package-lock.json
├── package.json
├── preload.js
└── store.js
```

Within ```preload.js```, have the following code:
```js
const { contextBridge, ipcRenderer } = require('electron')

window.ipcRenderer = ipcRenderer;

// Allows for save-load in vanilla js
contextBridge.exposeInMainWorld('store', {
  save: (key, content) => ipcRenderer.send('store:save', key, content),
  load: (key) => ipcRenderer.invoke('store:load', key),
})
```

This piece of code creates two new functions that could be ran in vanilla ```js```, ```store.save()``` and ```store.load()```.
These two functions doesn't actually call the save and load funtion we sat up in ```main.js```, they just send a message to ```main.js```.

That message is one of the following, depending on whether save or load is called:
- 'store:save' + key + content
- 'store:load' + key

If we configure ```main.js``` to call the corresponding functions when a message is recieved, ```store.save()``` would effectively be the same as ```handleSave()```, same with ```store.load()```.

### Setup ```main.js```

Heading back to ```main.js```, there are three tasks we need to accomplish.

**First, import some modules we would need later on.**

Import ```ipcMain``` along with ```app``` and ```BrowserWindow```:
```js
const { app, BrowserWindow, ipcMain } = require('electron');
```

Import ```path```:
```js
const path = require('path');
```

**Second, set our preload script to actually preload, meaning it loads before any other web-content.**

When creating the app window in ```createWindow()```, add the follow snippet to make ```preload.js``` a preload script.

```js
webPreferences: {
  preload: path.join(__dirname, './preload.js'),
},
```

The ```createWindow()``` function should look like this afterwards:

```js
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
```

**Third, make ```main.js``` respond to save & load messages.**

When the app is ready, before calling ```createWindow()```, add these two lines:

```js
// listen for save event
ipcMain.on('store:save', handleSave);
// listen and respond for load event
ipcMain.handle('store:load', handleLoad);
```

For saving, no callback is needed so ```ipcMain.on()``` is enough. For loading the content is wanted, so ```ipcMain.handle()``` which has callback is used.

```main.js``` should look something like:

```js
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
})

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
```

## Vanilla ```js```

With everything configured, it's time to take use of the save and load functions.

### Linking & Testing

Make another file named ```index.js```

File structure:
```
.
├── index.html
├── index.js
├── main.js
├── package-lock.json
├── package.json
├── preload.js
└── store.js
```

Link ```index.html``` with ```index.js``` by adding:
```html
<!-- index.html -->
<script src="./index.js" type = "module"></script>
```

Go into ```index.js``` and add:
```js
store.save("text", "vanilla");
```

Run the app and you should find
```{"text":"vanilla"}```
in ```storage.json``` rather than what was in there previously.

In ```index.js``` add:
```js
console.log(await store.load("text"));
```
Re-run the app. You should find "vanilla" in the webpage console.

> Note that there was ```await```, this is because we are accessing the callback, and ```await``` makes sure the process is complete before the value is accessed. ```await``` should be added before all load action.

### Textarea Example

You have now learned about simple saving and loading using electron. Using the save and load function to implement an auto-saving and content-restoring textarea wouldn't be shown here, as it's just **js** and **html** skills, unrelated to electron.

A sample electron app with everything taught in this tutorial along with an implemented auto-save-restore textarea could be found here.

Note that the 'node_modules' directory is removed in the sample, dependencies would have to be manually installed if you want to run the sample.

Thank you for going through this tutorial, this would be the end!
