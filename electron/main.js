const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
const { spawn, execFileSync } = require('child_process')
const { existsSync, appendFileSync } = require('fs')
const path = require('path')
const http = require('http')
const net = require('net')

const PORT = 3333
const isDev = !app.isPackaged

function log(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log')
    appendFileSync(logPath, `${new Date().toISOString()} | ${msg}\n`)
  } catch (_) {}
  console.log('[ana]', msg)
}

function isPortInUse(port) {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.listen(port, '127.0.0.1', () => { srv.close(() => resolve(false)) })
    srv.on('error', () => resolve(true))
  })
}

async function killProcessOnPort(port) {
  const inUse = await isPortInUse(port)
  if (!inUse) return
  log(`Porta ${port} ocupada — a tentar terminar processo anterior`)
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 5000 })
    const m = out.match(new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`))
    if (m && m[1] && m[1] !== '0') {
      execFileSync('taskkill', ['/F', '/PID', m[1]], { timeout: 5000 })
      log(`PID ${m[1]} terminado`)
      await new Promise(r => setTimeout(r, 500))
    }
  } catch (e) {
    log(`killProcessOnPort erro: ${e.message}`)
  }
}

// Em produção o electron-builder coloca os ficheiros em resources/app/ (asar:false)
const appRoot = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'app')

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

  // Modo dev: correr prisma db push de forma síncrona
  const prismaBin = [
    path.join(appRoot, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(appRoot, 'node_modules', 'prisma', 'dist', 'bin.js'),
  ].find(p => existsSync(p))

  if (!prismaBin) throw new Error('Binário Prisma não encontrado em node_modules.')

  const schemaPath = path.join(appRoot, 'prisma', 'schema.prisma')
  try {
    execFileSync(process.execPath, [prismaBin, 'db', 'push', '--schema', schemaPath], {
      cwd: appRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
      timeout: 30_000,
    })
  } catch (e) {
    log(`prisma db push falhou (ignorado): ${e.message}`)
  }
}

function startNextServer() {
  if (!isDev) {
    // Produção: servidor autónomo gerado pelo Next.js standalone
    const standaloneDir = path.join(appRoot, '.next', 'standalone')
    const serverPath    = path.join(standaloneDir, 'server.js')
    serverProcess = spawn(
      process.execPath,
      [serverPath],
      {
        cwd: standaloneDir,
        env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    )
  } else {
    // Dev: next start com a build normal
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
  }

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
    const deadline = Date.now() + 120_000  // 120s total
    let attempts = 0
    const attempt = () => {
      attempts++
      log(`A aguardar servidor na porta ${PORT}... (tentativa ${attempts})`)
      const req = http.get(`http://localhost:${PORT}`, res => {
        res.resume()
        log('Servidor respondeu — a abrir janela principal')
        resolve()
      })
      req.setTimeout(3000, () => req.destroy())
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(
            'A Ana não conseguiu arrancar. Por favor feche e abra novamente.\n' +
            'Se o problema persistir, reinicie o computador.'
          ))
        } else {
          setTimeout(attempt, 1000)
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
  const version = app.getVersion()

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
          click: () => mainWindow?.loadURL(`http://localhost:${PORT}/settings`),
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
          click: () => shell.openExternal('https://github.com/danielfranca47/ana-assistant'),
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
  log('Electron iniciado')

  await killProcessOnPort(PORT)

  createSplashWindow()
  await createStore()
  setServerEnv()
  buildMenu()
  createWindow()

  log('A verificar base de dados...')
  try {
    await initDatabase()
    log('Base de dados pronta')
  } catch (e) {
    log(`ERRO initDatabase: ${e.message}`)
    dialog.showErrorBox('Erro ao inicializar base de dados', e.message)
    app.quit()
    return
  }

  log('A lançar servidor Next.js...')
  startNextServer()

  try {
    await waitForServer()
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
