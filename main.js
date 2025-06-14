/**
 * Main process file for the Electron application.
 * This file handles the application lifecycle, window creation, and IPC communication.
 */
console.log('Hello from Electron')

// Import required Electron modules and Node.js path module
const { app, BrowserWindow, ipcMain, Menu, nativeTheme, dialog } = require('electron')
const path = require('node:path')
const { spawn } = require('child_process')
const fs = require('fs')

/**
 * Creates the main application window with appropriate settings
 * Sets up the preload script and loads the main HTML file
 */
const createWindow = () => {
  // Create a new browser window with dimensions of 800x800
  const win = new BrowserWindow({
    width: 800,
    height: 800,
    resizable: false,
    webPreferences: {
      // Preload script runs before the renderer process starts
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Load the main HTML file
  win.loadFile('index.html')
  // Open DevTools for debugging (can be removed in production)
  // win.webContents.openDevTools()
}

// When Electron has finished initializing
app.whenReady().then(() => {
  // Remove the default application menu
  Menu.setApplicationMenu(null)
  
  // Handle ping IPC message for testing communication
  ipcMain.handle('ping', () => 'pong')
  
  /**
   * Toggle between dark and light mode
   * Returns the current dark mode state after toggling
   */
  ipcMain.handle('dark-mode:toggle', () => {
    console.log('[Dark Mode] Toggle theme: Current mode =', nativeTheme.shouldUseDarkColors ? 'Dark' : 'Light');
    // Switch to opposite theme
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'dark';
    }
    const newMode = nativeTheme.shouldUseDarkColors ? 'Dark' : 'Light';
    console.log('[Dark Mode] Theme switched to:', newMode);
    
    // Notify all windows that theme has been updated
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode:updated', nativeTheme.shouldUseDarkColors);
    });
    return nativeTheme.shouldUseDarkColors;
  });

  /**
   * Reset theme to follow system preferences
   */
  ipcMain.handle('dark-mode:system', () => {
    console.log('[Dark Mode] Reset to system theme');
    nativeTheme.themeSource = 'system';
    const systemMode = nativeTheme.shouldUseDarkColors ? 'Dark' : 'Light';
    console.log('[Dark Mode] Current system mode:', systemMode);
    
    // Notify all windows that theme has been updated
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode:updated', nativeTheme.shouldUseDarkColors);
    });
  });

  /**
   * Force light mode regardless of system preferences
   * Returns false to indicate light mode is active
   */
  ipcMain.handle('dark-mode:light', () => {
    console.log('[Light Mode] Switch to light mode');
    nativeTheme.themeSource = 'light';
    
    // Notify all windows that theme has been updated
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode:updated', nativeTheme.shouldUseDarkColors);
    });
    return false;
  });

  /**
   * Process a file using SHCarrier.exe
   * @param {string} filePath - Path to the input file
   * @param {Object} options - Processing options
   * @returns {Object} - Processing result
   */
  ipcMain.handle('process-file', async (event, { filePath, options }) => {
    console.log('[SHCarrier] Processing file:', filePath);
    console.log('[SHCarrier] Options:', options);
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }
    
    // Build command arguments
    const args = ['-i', filePath];
    
    // Add options based on user selections
    if (options.useArea) {
      args.push('-Area');
    }
    
    if (options.stdName && options.stdName !== 'STD') {
      args.push('-STD', options.stdName);
    }
    
    if (options.useGBK) {
      args.push('-GBK');
    }
    
    if (options.devMode) {
      args.push('-dev');
    }
    
    // Get the correct path to the executable based on the environment
    // In development mode (or when not explicitly in production), use __dirname
    // In production build, use process.resourcesPath
    const isProduction = process.env.NODE_ENV === 'production';
    const isPackaged = app.isPackaged;
    
    // If either NODE_ENV is explicitly set to 'production' OR the app is packaged,
    // consider it production mode
    const appPath = (isProduction || isPackaged) ? process.resourcesPath : __dirname;
    const exePath = path.join(appPath, 'SHCarrier.exe');
    
    console.log('[SHCarrier] Is production env:', isProduction);
    console.log('[SHCarrier] Is packaged:', isPackaged);
    console.log('[SHCarrier] Application path:', appPath);
    console.log('[SHCarrier] Executable path:', exePath);
    console.log('[SHCarrier] Command:', exePath, args.join(' '));
    
    try {
      // First verify the executable exists
      if (!fs.existsSync(exePath)) {
        console.error('[SHCarrier] Executable not found at path:', exePath);
        return { 
          success: false, 
          error: `Executable not found: ${exePath}. Please ensure SHCarrier.exe is present in the application directory.` 
        };
      }
      
      // Execute SHCarrier.exe with the provided arguments
      return new Promise((resolve, reject) => {
        console.log('[SHCarrier] Spawning process with working directory:', path.dirname(filePath));
        
        // Use try-catch around spawn to catch any immediate errors
        let shCarrier;
        try {
          shCarrier = spawn(exePath, args, { 
            cwd: path.dirname(filePath),
            shell: false,  // Don't use shell to avoid command injection
            windowsHide: false  // Allow window to show for debugging purposes
          });
        } catch (spawnError) {
          console.error('[SHCarrier] Error during spawn:', spawnError);
          return reject({ success: false, error: `Failed to launch process: ${spawnError.message}` });
        }
        
        let stdout = '';
        let stderr = '';
        
        shCarrier.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log('[SHCarrier] Output:', output);
          
          // Send progress updates to the renderer
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('process-file:progress', { output });
          });
        });
        
        shCarrier.stderr.on('data', (data) => {
          const error = data.toString();
          stderr += error;
          console.error('[SHCarrier] Error:', error);
          
          // Send error updates to the renderer
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('process-file:error', { error });
          });
        });
        
        shCarrier.on('close', (code) => {
          console.log('[SHCarrier] Process exited with code:', code);
          
          if (code === 0) {
            // Get the output file paths
            const inputBaseName = path.basename(filePath, path.extname(filePath));
            const inputDirName = path.dirname(filePath);
            const summaryFilePath = path.join(inputDirName, `${inputBaseName}-summary.tsv`);
            const calculationFilePath = path.join(inputDirName, `${inputBaseName}-cal.tsv`);
            
            // Check if output files were created
            const summaryExists = fs.existsSync(summaryFilePath);
            const calculationExists = fs.existsSync(calculationFilePath);
            
            resolve({ 
              success: true, 
              code, 
              stdout, 
              stderr,
              outputFiles: {
                summary: summaryExists ? summaryFilePath : null,
                calculation: calculationExists ? calculationFilePath : null
              }
            });
          } else {
            resolve({ success: false, code, stdout, stderr });
          }
        });
        
        shCarrier.on('error', (error) => {
          console.error('[SHCarrier] Failed to start process:', error);
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.error('[SHCarrier] Exception:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Open a file dialog to select input files
   */
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Data Files', extensions: ['txt', 'csv', 'tsv'] },
        { name: 'All Files', extensions: [] } // 尝试使用具体文件类型列表代替通配符
      ]
    });
    
    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }
    
    return { canceled: false, filePath: filePaths[0] };
  });

  /**
   * Open a file in the system's default application
   */
  ipcMain.handle('open-file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
      const { shell } = require('electron');
      shell.openPath(filePath);
      return { success: true };
    } else {
      return { success: false, error: 'File does not exist' };
    }
  });

  // Create the main application window
  createWindow()

  // On macOS, recreate the window when the dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit the application when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})