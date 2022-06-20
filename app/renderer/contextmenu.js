const {ipcRenderer} = require("electron")


window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    ipcRenderer.send('show-context-menu')
});