const {app, BrowserWindow, ipcMain, dialog, ipcRenderer, Menu} = require('electron')
const i18n = require("./i18n/i18n.js")
const {ProjectWindow} = require("./projectWindow.js");
const {DocumentationWindow} = require("./documentationWindow.js");
const {AboutWindow} = require("./aboutWindow.js");
const {setupMenus} = require('./appmenus.js');
const {onForceQuit} = require('./forceQuitDetect');
const {Inklecate} = require("./inklecate.js");

function inkJSNeedsUpdating() {
    return false;
    // dialog.showMessageBox({
    //   type: 'error',
    //   buttons: ['Okay'],
    //   title: 'Export for web unavailable',
    //   message: "Sorry, export for web is currently disabled, until inkjs is updated to support the latest version of ink. You can download a previous version of Inky that supports inkjs and use that instead, although some of the latest features of ink may be missing."
    // });
    // return true;
}


// main
ipcMain.on('show-context-menu', (event) => {
    const template = [
        {
            label: 'Cut',
            role: 'cut' 
        },
        {
            label: 'Copy',
            role: 'copy' 
        },
        {
            label: 'Paste',
            role: 'paste' 
        },
      { type: 'separator' },
    ]
    const menu = Menu.buildFromTemplate(template)
    menu.popup(BrowserWindow.fromWebContents(event.sender))
})


ipcMain.handle("showSaveDialog", async (event,saveOptions) => {
    return dialog.showSaveDialog(saveOptions) 
});

ipcMain.handle("show-word-count", async (event, incomingMessage) =>{
        const options = {
            type: "none",
            buttons: ["Okay"],
            title: "Alert Message!",
            message: incomingMessage
        }
        dialog.showMessageBox(event.render, options)
});

ipcMain.handle("try-close", async (event) =>{
    return dialog.showMessageBox({
        type: "warning",
        message: i18n._("Would you like to save changes before exiting?"),
        detail: i18n._("Your changes will be lost if you don't save."),
        buttons: [
            i18n._("Save"),
            i18n._("Don't save"),
            i18n._("Cancel")
        ],
        defaultId: 0
    })
    
})

app.on('will-finish-launching', function () {
    app.on("open-file", function (event, path) {
        ProjectWindow.open(path);
        event.preventDefault();
    });

});

let isQuitting = false;
let theme = ProjectWindow.getViewSettings().theme;
let zoom = ProjectWindow.getViewSettings().zoom;

app.on('before-quit', function () {
    // We need this to differentiate between pressing quit (which should quit) or closing all windows
    // (which leaves the app open)
    isQuitting = true;
});

ipcMain.on("project-cancelled-close", (event) => {
    isQuitting = false;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {

    //If all the windows are closed, we close the app
    app.on('window-all-closed', function () {
        if (process.platform != 'darwin' || isQuitting) {
            app.quit();
        }
    });
    //We set up the menus for the app
    setupMenus({
        new: () => {
            ProjectWindow.createEmpty();
        },
        newInclude: () => {
            var win = ProjectWindow.focused();
            if (win) win.newInclude();
        },
        open: () => {
            console.log("Test!")
            ProjectWindow.open();
        },
        save: () => {
            var win = ProjectWindow.focused();
            if (win) win.save();
        },
        exportJson: () => {
            var win = ProjectWindow.focused();
            if (win) win.exportJson();
        },
        exportForWeb: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportForWeb();
        },
        exportJSOnly: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportJSOnly();
        },
        toggleTags: (item, focusedWindow, event) => {
            focusedWindow.webContents.send("set-tags-visible", item.checked);
        },
        nextIssue: (item, focusedWindow) => {
            focusedWindow.webContents.send("next-issue");
        },
        gotoAnything: (item, focusedWindow) => {
            focusedWindow.webContents.send("goto-anything");
        },
        addWatchExpression: (item, focusedWindow) => {
            focusedWindow.webContents.send("add-watch-expression");
        },
        showDocs: () => {
            DocumentationWindow.openDocumentation(theme);
        },
        showAbout: () => {
            AboutWindow.showAboutWindow(theme);
        },
        keyboardShortcuts: () => {
            var win = ProjectWindow.focused();
            if (win) win.keyboardShortcuts();
        },
        stats: () => {
            var win = ProjectWindow.focused();
            if (win) win.stats();
        },
        zoomIn: () => {
          var win = ProjectWindow.focused();
          if (win != null) {
            win.zoom(2);
            //Convert change from font size to zoom percentage
            zoom = (parseInt(zoom) + Math.floor(2*100/12)).toString();
            ProjectWindow.addOrChangeViewSetting('zoom', zoom);
          }
        },
        zoomOut: () => {
          var win = ProjectWindow.focused();
          if (win != null) {
            win.zoom(-2);
            //Convert change from font size to zoom percentage
            zoom = (parseInt(zoom) - Math.floor(2*100/12)).toString();
            ProjectWindow.addOrChangeViewSetting('zoom', zoom);
          }
        },
        zoom: (zoom_percent) => {
          var win = ProjectWindow.focused();
          if (win != null) {
            win.zoom(zoom_percent);
            zoom = zoom_percent.toString();
            ProjectWindow.addOrChangeViewSetting('zoom', zoom)
          }
        },
        insertSnippet: (focussedWindow, snippet) => {
            if( focussedWindow )
                focussedWindow.webContents.send('insertSnippet', snippet);
        },
        changeTheme: (newTheme) => {
          theme = newTheme;
          AboutWindow.changeTheme(newTheme);
          DocumentationWindow.changeTheme(newTheme);
          ProjectWindow.addOrChangeViewSetting('theme', newTheme)
        }
    });

    let openedSpecificFile = false;
    if (process.platform == "win32" && process.argv.length > 1) {
        for (let i = 1; i < process.argv.length; i++) {
            var arg = process.argv[i].toLowerCase();
            if (arg.endsWith(".ink")) {
                var fileToOpen = process.argv[1];
                var w = ProjectWindow.open(fileToOpen);
                openedSpecificFile = true;
                //Setup last stored zoom
                if(w) {
                    w.browserWindow.webContents.once('dom-ready', () => {
                        ProjectWindow.focused().zoom(zoom);
                    });
                }
                break;
            }
        }
    }
    if (!openedSpecificFile) {
        var w = ProjectWindow.createEmpty();
        //Setup last stored zoom
        w.browserWindow.webContents.once('dom-ready', () => {
            ProjectWindow.focused().zoom(zoom);
        });
    }

    //Setup last stored theme
    AboutWindow.changeTheme(theme);
    DocumentationWindow.changeTheme(theme);

    // Debug
    //w.openDevTools();
});

function finalQuit() {
    Inklecate.killSessions();
}

onForceQuit(finalQuit);
app.on("will-quit", finalQuit);
