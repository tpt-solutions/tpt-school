const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

const PORT = 3737
const APP_URL = `http://localhost:${PORT}`

// Path to the bundled Next.js app (inside extraResources in production, sibling dir in dev)
const isDev = !app.isPackaged
const appDir = isDev
  ? path.join(__dirname, '..', 'tpt-school')
  : path.join(process.resourcesPath, 'app')

let mainWindow = null
let nextServer = null

function waitForServer(url, retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get(url + '/api/health', (res) => {
        if (res.statusCode === 200) return resolve()
        retry()
      }).on('error', retry)
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) return reject(new Error('Next.js server did not start in time'))
      setTimeout(check, delay)
    }
    check()
  })
}

function startNextServer() {
  const nodeExe = process.execPath
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    DATABASE_URL: `file:${path.join(app.getPath('userData'), 'tpt-school.db')}`,
  }

  nextServer = spawn(nodeExe, ['server.js'], {
    cwd: path.join(appDir, '.next', 'standalone'),
    env,
    windowsHide: true,
  })

  nextServer.stdout.on('data', d => console.log('[next]', d.toString().trim()))
  nextServer.stderr.on('data', d => console.error('[next]', d.toString().trim()))
  nextServer.on('exit', code => console.log('[next] exited with code', code))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'TPT School',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(APP_URL)

  // Open external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  startNextServer()
  try {
    await waitForServer(APP_URL)
  } catch (err) {
    console.error('Server failed to start:', err)
    app.quit()
    return
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill()
    nextServer = null
  }
})
