/**
 * Renderer Process Script
 * 
 * This script runs in the renderer process and handles the UI interactions.
 * It communicates with the main process through the exposed APIs in the preload script.
 * Primarily responsible for theme switching functionality and UI updates.
 */
console.log('renderer.js loaded and executing');

// Ensure DOM is fully loaded before binding event listeners
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded, binding event listeners');

  // Get references to DOM elements that control theme switching
  const darkModeBtn = document.getElementById('toggle-dark-mode');
  const lightModeBtn = document.getElementById('toggle-light-mode');
  const resetBtn = document.getElementById('reset-to-system');
  const themeSource = document.getElementById('theme-source');

  console.log('DOM elements check:', { darkModeBtn, lightModeBtn, resetBtn, themeSource });

  /**
   * Initialize the application theme
   * Toggles the theme once to set the initial state based on system preferences
   */
  const initializeTheme = async () => {
    console.log('Initializing theme...');
    try {
      const isDarkMode = await window.darkMode.toggle();
      console.log('Theme initialization result:', isDarkMode);
      updateThemeClass(isDarkMode);
    } catch (error) {
      console.error('Theme initialization failed:', error);
    }
  };

  /**
   * Updates the body class to reflect the current theme
   * @param {boolean} isDarkMode - Whether dark mode is active
   */
  const updateThemeClass = (isDarkMode) => {
    console.log('Updating theme style:', isDarkMode);
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
  };

  // Set up dark mode toggle button event handler
  if (darkModeBtn) {
    darkModeBtn.addEventListener('click', async () => {
      console.log('[Dark Mode] Toggle button clicked');
      try {
        const isDarkMode = await window.darkMode.toggle();
        const mode = isDarkMode ? 'Dark' : 'Light';
        themeSource.innerHTML = mode;
        updateThemeClass(isDarkMode);
        console.log('[Dark Mode] UI updated to:', mode);
      } catch (error) {
        console.error('[Dark Mode] Toggle failed:', error);
      }
    });
  } else {
    console.error('toggle-dark-mode button not found');
  }

  // Set up system theme reset button event handler
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      console.log('[Dark Mode] Reset button clicked');
      try {
        await window.darkMode.system();
        themeSource.innerHTML = 'System';
        console.log('[Dark Mode] System theme settings restored');
      } catch (error) {
        console.error('[Dark Mode] Reset failed:', error);
      }
    });
  } else {
    console.error('reset-to-system button not found');
  }

  // Set up light mode button event handler
  if (lightModeBtn) {
    lightModeBtn.addEventListener('click', async () => {
      console.log('[Light Mode] Toggle button clicked');
      try {
        await window.darkMode.light();
        themeSource.innerHTML = 'Light';
        updateThemeClass(false);
        console.log('[Light Mode] UI updated to: Light');
      } catch (error) {
        console.error('[Light Mode] Toggle failed:', error);
      }
    });
  } else {
    console.error('toggle-light-mode button not found');
  }

  /**
   * Listen for theme update events from the main process
   * This allows the UI to stay in sync when the theme changes
   * from outside the renderer (e.g., system theme changes)
   */
  try {
    window.darkMode.onUpdate((isDarkMode) => {
      console.log('[Dark Mode] Theme update notification received:', isDarkMode ? 'Dark' : 'Light');
      updateThemeClass(isDarkMode);
    });
    console.log('Theme update event listener registered');
  } catch (error) {
    console.error('Failed to register theme update event:', error);
  }

  // Initialize theme when the application starts
  initializeTheme();

  // Get references to file upload DOM elements
  const fileDropArea = document.getElementById('file-drop-area');
  const fileInput = document.getElementById('file-input');
  const fileSelectLink = document.querySelector('.file-select-link');
  const selectedFilePath = document.getElementById('selected-file-path');
  const processFileBtn = document.getElementById('process-file');
  const processingStatus = document.getElementById('processing-status');
  
  // Get references to processing options DOM elements
  const useAreaCheckbox = document.getElementById('use-area');
  const stdNameInput = document.getElementById('std-name');
  const useGBKCheckbox = document.getElementById('use-gbk');
  const devModeCheckbox = document.getElementById('dev-mode');

  // Variable to store the currently selected file path
  let currentFilePath = null;

  /**
   * Updates the UI to reflect the selected file
   * @param {string} filePath - Path to the selected file
   */
  const updateSelectedFile = (filePath) => {
    currentFilePath = filePath;
    selectedFilePath.textContent = filePath || 'None';
    processFileBtn.disabled = !filePath;
    
    // Clear any previous processing status
    processingStatus.textContent = '';
    processingStatus.classList.remove('success', 'error');
    
    console.log('[File Upload] Selected file:', filePath);
  };

  /**
   * Handle file drop events
   * @param {DragEvent} event - The drag event
   */
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    fileDropArea.classList.remove('highlight');
    
    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      
      // Check if the file is a CSV or TSV file
      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        // 在 Electron 中，我们需要使用 IPC 通信来获取文件路径
        // 因为拖拽的文件对象可能没有直接的 path 属性
        console.log('[File Upload] Drag file detected:', file.name);
        
        // 使用 openFileDialog 的方式不适合拖拽场景
        // 我们应该直接使用文件的路径（如果可用）或者使用其他方法
        if (file.path) {
          // Windows 平台通常可以直接获取 path
          console.log('[File Upload] Drag file path available:', file.path);
          updateSelectedFile(file.path);
        } else {
          // 对于其他平台或者无法获取路径的情况
          // 我们可以尝试使用 Electron 的 dialog API
          console.log('[File Upload] Drag file path not available, using dialog API');
          openFileDialog().then(result => {
            if (!result.canceled && result.filePath) {
              updateSelectedFile(result.filePath);
            }
          });
        }
      } else {
        processingStatus.textContent = 'Error: Please select a CSV or TSV file.';
        processingStatus.classList.add('error');
        console.error('[File Upload] Invalid file type:', file.name);
      }
    }
  };

  /**
   * Handle file select link click
   */
  const handleFileSelectClick = () => {
    // Directly open the file dialog without using the input element
    openFileDialog();
  };

  /**
   * Handle file input change events - this is now unused as we're using openFileDialog directly
   * @param {Event} event - The change event
   */
  const handleFileInputChange = (event) => {
    // This function is now unused, but we'll keep it for compatibility
    // and clear the input value so it doesn't interfere with our new approach
    if (event.target) {
      event.target.value = '';
    }
  };

  /**
   * Open file dialog to select a file
   */
  const openFileDialog = async () => {
    try {
      const result = await window.fileProcessor.openFileDialog();
      
      if (!result.canceled && result.filePath) {
        updateSelectedFile(result.filePath);
      }
    } catch (error) {
      console.error('[File Upload] Failed to open file dialog:', error);
    }
  };

  /**
   * Handle file drag over events
   * @param {DragEvent} event - The drag event
   */
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileDropArea.classList.add('highlight');
  };

  /**
   * Handle file drag leave events
   * @param {DragEvent} event - The drag event
   */
  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileDropArea.classList.remove('highlight');
  };

  /**
   * Process the selected file using SHCarrier.exe
   */
  const processFile = async () => {
    if (!currentFilePath) {
      processingStatus.textContent = 'Error: No file selected.';
      processingStatus.classList.add('error');
      return;
    }
    
    // Disable the process button during processing
    processFileBtn.disabled = true;
    
    // Clear previous status and show processing message
    processingStatus.textContent = 'Processing file...';
    processingStatus.classList.remove('success', 'error');
    
    // Get processing options
    const options = {
      useArea: useAreaCheckbox.checked,
      stdName: stdNameInput.value.trim(),
      useGBK: useGBKCheckbox.checked,
      devMode: devModeCheckbox.checked
    };
    
    console.log('[SHCarrier] Processing file with options:', options);
    
    try {
      const result = await window.fileProcessor.processFile(currentFilePath, options);
      
      if (result.success) {
        // Show success message with links to output files
        let statusMessage = 'Processing completed successfully.';
        
        if (result.outputFiles) {
          statusMessage += '<br><br>Output files:';
          
          if (result.outputFiles.summary) {
            statusMessage += `<br><a href="#" class="output-file-link" data-path="${result.outputFiles.summary}">Summary File</a>`;
          }
          
          if (result.outputFiles.calculation) {
            statusMessage += `<br><a href="#" class="output-file-link" data-path="${result.outputFiles.calculation}">Calculation File</a>`;
          }
        }
        
        processingStatus.innerHTML = statusMessage;
        processingStatus.classList.add('success');
        
        // Add event listeners to output file links
        const outputFileLinks = processingStatus.querySelectorAll('.output-file-link');
        outputFileLinks.forEach(link => {
          link.addEventListener('click', async (event) => {
            event.preventDefault();
            const filePath = event.target.getAttribute('data-path');
            
            if (filePath) {
              try {
                await window.fileProcessor.openFile(filePath);
              } catch (error) {
                console.error('[SHCarrier] Failed to open output file:', error);
              }
            }
          });
        });
      } else {
        // Show error message
        processingStatus.textContent = `Error: Processing failed. ${result.stderr || ''}`;
        processingStatus.classList.add('error');
      }
    } catch (error) {
      processingStatus.textContent = `Error: ${error.message || 'Unknown error occurred.'}`;
      processingStatus.classList.add('error');
      console.error('[SHCarrier] Processing error:', error);
    } finally {
      // Re-enable the process button
      processFileBtn.disabled = !currentFilePath;
    }
  };

  /**
   * Register progress update handler
   */
  const registerProgressHandler = () => {
    try {
      window.fileProcessor.onProgress((data) => {
        if (data.output) {
          console.log('[SHCarrier] Progress:', data.output);
          // Could update a progress indicator here if needed
        }
      });
      
      window.fileProcessor.onError((data) => {
        if (data.error) {
          console.error('[SHCarrier] Error:', data.error);
          // Could update an error indicator here if needed
        }
      });
      
      console.log('[SHCarrier] Progress handlers registered');
    } catch (error) {
      console.error('[SHCarrier] Failed to register progress handlers:', error);
    }
  };

  // Set up file drop area event listeners
  if (fileDropArea) {
    fileDropArea.addEventListener('drop', handleDrop);
    fileDropArea.addEventListener('dragover', handleDragOver);
    fileDropArea.addEventListener('dragleave', handleDragLeave);
  } else {
    console.error('file-drop-area element not found');
  }

  // Set up file input event listener
  if (fileInput) {
    fileInput.addEventListener('change', handleFileInputChange);
  } else {
    console.error('file-input element not found');
  }

  // Set up file select link event listener
  if (fileSelectLink) {
    fileSelectLink.addEventListener('click', (event) => {
      event.preventDefault();
      handleFileSelectClick();
    });
  } else {
    console.error('file-select-link element not found');
  }

  // Set up process file button event listener
  if (processFileBtn) {
    processFileBtn.addEventListener('click', processFile);
  } else {
    console.error('process-file button not found');
  }

  // Register progress handlers
  registerProgressHandler();
});
