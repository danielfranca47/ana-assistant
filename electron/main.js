const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = 3333
const isDev = !app.isPackaged

// Raiz da app: em dev é a pasta do projecto, em produção é resources/
const appRoot = isDev
  ? path.join(__dirname, '..')
  : process.resourcesPath

let serverProcess = null
let mainWindow = null

function setDbUrl() {
  const dbFile = path.join(app.getPath('userData'), 'ana.db').replace(/\\/g, '/')
  process.env.DATABASE_URL = `file:${dbFile}`
}

function startNextServer() {
  const nextBin = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

  serverProcess = spawn(
    process.execPath,
    [nextBin, 'start', '-p', String(PORT)],
    {
      cwd: appRoot,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  serverProcess.stdout.on('data', d => process.stdout.write('[next] ' + d))
  serverProcess.stderr.on('data', d => process.stderr.write('[next] ' + d))

  serverProcess.on('error', err => {
    console.error('[next] Erro ao lançar o servidor:', err.message)
  })
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000
    const attempt = () => {
      const req = http.get(`http://localhost:${PORT}`, res => {
        res.resume()
        if (res.statusCode === 200) {
          resolve()
        } else {
          // 302 (redirect p/ /setup) também significa servidor pronto
          resolve()
        }
      })
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error('O servidor Next.js não arrancou em 30 segundos.'))
        } else {
          setTimeout(attempt, 500)
        }
      })
      req.end()
    }
    setTimeout(attempt, 500)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ana — Assistente Pessoal',
    icon: path.join(appRoot, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.on('closed', () => {
    if (serverProcess) serverProcess.kill()
    mainWindow = null
    app.quit()
  })
}

app.whenReady().then(async () => {
  setDbUrl()
  createWindow()
  startNextServer()

  try {
    await waitForServer()
    mainWindow.loadURL(`http://localhost:${PORT}`)
  } catch (err) {
    dialog.showErrorBox('Erro ao iniciar a Ana', err.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  app.quit()
})
