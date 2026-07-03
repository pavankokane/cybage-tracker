import { contextBridge, ipcRenderer } from 'electron'

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    getScraperData: () => ipcRenderer.invoke('get-scraper-data'),
    // 🟢 UPDATED: Accepts custom credentials argument object
    triggerRefresh: (mode, credentials) => ipcRenderer.invoke('trigger-refresh', mode, credentials),
    onScraperUpdate: (callback) => {
      const subscription = (event, value) => callback(value)
      ipcRenderer.on('scraper-status-updated', subscription)
      return () => ipcRenderer.removeListener('scraper-status-updated', subscription)
    }
  })
} catch (error) {
  console.error(error)
}