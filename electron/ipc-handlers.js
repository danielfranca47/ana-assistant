'use strict'

/**
 * Regista handlers IPC renderer→main.
 * A persistência de chaves de API é feita via serverProcess.on('message') em main.js.
 */
function registerIpcHandlers(ipcMain, store) {
  // Reservado para handlers futuros (ex: abrir diálogos nativos, janelas de preferências)
}

module.exports = { registerIpcHandlers }
