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

  // Theme is now automatically managed based on system preferences
  console.log('Theme is now automatically managed based on system preferences');

  /**
   * Initialize the application theme
   * Sets theme to follow system preferences
   */
  const initializeTheme = async () => {
    console.log('Initializing theme to use system preferences...');
    try {
      // Set theme to system
      await window.darkMode.system();
      // Get current system theme status
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('System theme detected:', isDarkMode ? 'Dark' : 'Light');
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

  // Theme control buttons have been removed - theme now automatically follows system preferences

  /**
   * Listen for theme update events from the main process
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
  const fileInput = document.getElementById('file-input');
  const selectFileButton = document.getElementById('select-file-button');
  const selectedFilePath = document.getElementById('selected-file-path');
  const processFileBtn = document.getElementById('process-file');
  const processingStatus = document.getElementById('processing-status');
  
  // Get references to processing options DOM elements
  const useAreaCheckbox = document.getElementById('use-area');
  const stdNameInput = document.getElementById('std-name');
  const useGBKCheckbox = document.getElementById('use-gbk');
  // Development mode is now hidden from UI and disabled by default
  const devModeCheckbox = { checked: false }; // Simulate checkbox element with dev mode disabled

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
   * Handle file select button click
   */
  const handleSelectFileButtonClick = () => {
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

  // Set up file input event listener
  if (fileInput) {
    fileInput.addEventListener('change', handleFileInputChange);
  } else {
    console.error('file-input element not found');
  }

  // Set up select file button event listener
  if (selectFileButton) {
    selectFileButton.addEventListener('click', handleSelectFileButtonClick);
  } else {
    console.error('select-file-button element not found');
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
