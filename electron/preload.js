// Context bridge — extend here if renderer needs IPC access
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('tptDesktop', {
  platform: process.platform,
})
