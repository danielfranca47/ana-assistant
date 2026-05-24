const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
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
let splashWindow = null
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

  const prismaBin = [
    path.join(appRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(appRoot, 'node_modules', 'prisma', 'dist', 'bin.js'),
  ].find(p => existsSync(p))

  if (!prismaBin) throw new Error('Binário Prisma não encontrado em node_modules.')

  const schemaPath = path.join(appRoot, 'prisma', 'schema.prisma')

  await new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [prismaBin, 'db', 'push', '--schema', schemaPath],
      { cwd: appRoot, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit' }
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
      env: { ...process.env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
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

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ana — Assistente Pessoal',
    icon: path.join(appRoot, 'public', 'icon.png'),
    show: false, // mostrar apenas após ready-to-show
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

function buildMenu() {
  const version = require(path.join(appRoot, 'package.json')).version ?? '0.1.0'

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Ana Assistant',
      submenu: [
        {
          label: 'Sobre a Ana',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Sobre a Ana',
            message: `Ana — Assistente Pessoal\nVersão ${version}`,
            detail: 'Desenvolvida com Next.js + Electron.',
            buttons: ['Fechar'],
          }),
        },
        { type: 'separator' },
        {
          label: 'Configurações',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.loadURL(`http://localhost:${PORT}/setup`),
        },
        { type: 'separator' },
        {
          label: 'Verificar actualizações',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Actualizações',
            message: 'Sem actualizações disponíveis.',
            detail: `Versão actual: ${version}`,
            buttons: ['Fechar'],
          }),
        },
        { type: 'separator' },
        { label: 'Sair', role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Copiar',           role: 'copy',      accelerator: 'CmdOrCtrl+C' },
        { label: 'Colar',            role: 'paste',     accelerator: 'CmdOrCtrl+V' },
        { label: 'Seleccionar tudo', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Documentação',
          click: () => shell.openExternal('https://github.com/SEU-USUARIO/ana-assistant'),
        },
      ],
    },
  ]))
}

app.whenReady().then(async () => {
  createSplashWindow() // feedback imediato ao utilizador

  await createStore()
  setServerEnv()
  buildMenu()
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
    mainWindow.once('ready-to-show', () => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
        splashWindow = null
      }
      mainWindow.show()
    })
  } catch (e) {
    dialog.showErrorBox('Erro ao iniciar a Ana', e.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  app.quit()
})
