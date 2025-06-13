/**
 * Preload Script
 * 
 * This script runs in a privileged context before the renderer process starts.
 * It can access both Node.js APIs and a limited set of Electron APIs.
 * Used to expose specific functionality from the main process to the renderer process.
 */
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose the darkMode API to the renderer process
 * This allows the renderer to communicate with the main process
 * for theme-related functionality while maintaining security context isolation
 */
contextBridge.exposeInMainWorld('darkMode', {
  // Toggle between dark and light mode
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  
  // Force light mode
  light: () => ipcRenderer.invoke('dark-mode:light'),
  
  // Reset to system theme preferences
  system: () => ipcRenderer.invoke('dark-mode:system'),
  
  // Register a callback to be notified when the theme changes
  onUpdate: (callback) => ipcRenderer.on('dark-mode:updated', (event, isDarkMode) => callback(isDarkMode))
});

/**
 * Expose the fileProcessor API to the renderer process
 * This allows the renderer to communicate with the main process
 * for file processing functionality
 */
contextBridge.exposeInMainWorld('fileProcessor', {
  // Process a file using SHCarrier.exe
  processFile: (filePath, options) => ipcRenderer.invoke('process-file', { filePath, options }),
  
  // Open a file dialog to select input files
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Open a file in the system's default application
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // Register a callback to be notified of processing progress
  onProgress: (callback) => ipcRenderer.on('process-file:progress', (event, data) => callback(data)),
  
  // Register a callback to be notified of processing errors
  onError: (callback) => ipcRenderer.on('process-file:error', (event, data) => callback(data))
});