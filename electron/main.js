const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const { existsSync } = require('fs')
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
let store = null

// electron-store v11 é ESM-only: usar dynamic import
async function createStore() {
  const { default: Store } = await import('electron-store')
  store = new Store({ encryptionKey: 'ana-assistant' })
}

function setServerEnv() {
  const userData = app.getPath('userData')
  const dbFile = path.join(userData, 'ana.db').replace(/\\/g, '/')
  process.env.DATABASE_URL       = `file:${dbFile}`
  process.env.ELECTRON_USER_DATA = userData
  process.env.IS_ELECTRON        = 'true'
  if (store.get('anthropicKey')) process.env.ANTHROPIC_API_KEY = store.get('anthropicKey')
  if (store.get('openaiKey'))    process.env.OPENAI_API_KEY   = store.get('openaiKey')
}

async function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'ana.db')
  if (existsSync(dbPath)) return

  // Mostrar ecrã de loading enquanto o schema é criado
  mainWindow.loadURL(
    'data:text/html,' +
    encodeURIComponent(`<!DOCTYPE html>
<html style="margin:0">
  <body style="background:#0a0a0a;color:#e5e5e5;display:flex;
               align-items:center;justify-content:center;
               height:100vh;font-family:system-ui;margin:0">
    <p style="opacity:.7">A preparar a Ana pela primeira vez…</p>
  </body>
</html>`)
  )

  const prismaBin = [
    path.join(appRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(appRoot, 'node_modules', 'prisma', 'dist', 'bin.js'),
  ].find(p => existsSync(p))

  if (!prismaBin) throw new Error('Binário Prisma não encontrado em node_modules.')

  const schemaPath = path.join(appRoot, 'prisma', 'schema.prisma')

  await new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [prismaBin, 'db', 'push', '--skip-generate', '--schema', schemaPath],
      { cwd: appRoot, env: { ...process.env }, stdio: 'inherit' }
    )
    proc.on('close', code =>
      code === 0
        ? resolve()
        : reject(new Error(`prisma db push saiu com código ${code}`))
    )
    proc.on('error', reject)
  })
}

function startNextServer() {
  const nextBin = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

  serverProcess = spawn(
    process.execPath,
    [nextBin, 'start', '-p', String(PORT)],
    {
      cwd: appRoot,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    }
  )

  serverProcess.stdout.on('data', d => process.stdout.write('[next] ' + d))
  serverProcess.stderr.on('data', d => process.stderr.write('[next] ' + d))
  serverProcess.on('error', e => console.error('[next] Erro:', e.message))

  // Receber chaves guardadas pelo API route via process.send()
  serverProcess.on('message', msg => {
    if (msg?.type === 'save-api-keys') {
      store.set('anthropicKey', msg.keys.anthropic)
      store.set('openaiKey',    msg.keys.openai)
    }
  })
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000
    const attempt = () => {
      const req = http.get(`http://localhost:${PORT}`, res => {
        res.resume()
        resolve()
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
  await createStore()
  setServerEnv()
  createWindow()

  try {
    await initDatabase()
  } catch (e) {
    dialog.showErrorBox('Erro ao inicializar base de dados', e.message)
    app.quit()
    return
  }

  startNextServer()

  try {
    await waitForServer()
    mainWindow.loadURL(`http://localhost:${PORT}`)
  } catch (e) {
    dialog.showErrorBox('Erro ao iniciar a Ana', e.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  app.quit()
})
