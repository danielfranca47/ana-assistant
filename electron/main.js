const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
const { spawn } = require('child_process')
const { existsSync, appendFileSync } = require('fs')
const path = require('path')
const http = require('http')

const PORT = 3333
const isDev = !app.isPackaged

function log(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log')
    appendFileSync(logPath, `${new Date().toISOString()} | ${msg}\n`)
  } catch (_) {}
  console.log('[ana]', msg)
}

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

  const { copyFileSync, mkdirSync } = require('fs')
  mkdirSync(app.getPath('userData'), { recursive: true })

  if (!isDev) {
    // App instalada: copiar base de dados template do pacote para userData
    const templateDb = path.join(appRoot, 'prisma', 'ana.db')
    if (!existsSync(templateDb)) {
      throw new Error(`Base de dados template não encontrada: ${templateDb}`)
    }
    copyFileSync(templateDb, dbPath)
    return
  }

  // Modo dev: correr prisma db push normalmente
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
      { cwd: appRoot, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const timer = setTimeout(() => { proc.kill(); reject(new Error('prisma db push timeout (30s)')) }, 30_000)
    proc.on('close', code => {
      clearTimeout(timer)
      code === 0 ? resolve() : reject(new Error(`prisma db push saiu com código ${code}`))
    })
    proc.on('error', e => { clearTimeout(timer); reject(e) })
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
    const deadline = Date.now() + 90_000  // 90s total
    let attempts = 0
    const attempt = () => {
      attempts++
      log(`waitForServer tentativa ${attempts}`)
      const req = http.get(`http://localhost:${PORT}`, res => {
        res.resume()
        log('waitForServer: servidor respondeu')
        resolve()
      })
      req.setTimeout(4000, () => {
        req.destroy()  // mata pedido pendurado; dispara 'error'
      })
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error('O servidor Next.js não arrancou em 90 segundos.'))
        } else {
          setTimeout(attempt, 800)
        }
      })
      req.end()
    }
    setTimeout(attempt, 1500)
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

function showMain() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy()
    splashWindow = null
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show()
  }
}

app.whenReady().then(async () => {
  log('app ready')
  createSplashWindow()

  await createStore()
  setServerEnv()
  buildMenu()
  createWindow()
  log('janelas criadas')

  try {
    await initDatabase()
    log('base de dados pronta')
  } catch (e) {
    log(`ERRO initDatabase: ${e.message}`)
    dialog.showErrorBox('Erro ao inicializar base de dados', e.message)
    app.quit()
    return
  }

  startNextServer()
  log('servidor Next.js iniciado')

  try {
    await waitForServer()
    log('servidor a responder — a carregar URL')
    mainWindow.loadURL(`http://localhost:${PORT}`)

    // Fallback: se ready-to-show não disparar em 10s, abre na mesma
    const fallback = setTimeout(() => {
      log('fallback ready-to-show activado')
      showMain()
    }, 10_000)

    mainWindow.once('ready-to-show', () => {
      clearTimeout(fallback)
      log('ready-to-show disparou')
      showMain()
    })
  } catch (e) {
    log(`ERRO waitForServer: ${e.message}`)
    dialog.showErrorBox('Erro ao iniciar a Ana', e.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  app.quit()
})
