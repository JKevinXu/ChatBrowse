document.addEventListener('DOMContentLoaded', function() {
  const statusDisplay = document.getElementById('status-display');
  
  function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const className = type === 'error' ? 'error' : type === 'success' ? 'success' : '';
    statusDisplay.innerHTML += `[${timestamp}] <span class="${className}">${message}</span>\n`;
    statusDisplay.scrollTop = statusDisplay.scrollHeight;
  }
  
  function clearLog() {
    statusDisplay.innerHTML = '';
  }

  // Check Extension Status
  document.getElementById('check-status').addEventListener('click', async function() {
    clearLog();
    log('Checking extension status...');
    
    try {
      const manifest = chrome.runtime.getManifest();
      log(`Extension name: ${manifest.name}`, 'success');
      log(`Version: ${manifest.version}`, 'success');
      
      // Check if content script is loaded
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        log('No active tab found', 'error');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          log(`Content script not loaded: ${chrome.runtime.lastError.message}`, 'error');
        } else {
          log('Content script is active', 'success');
        }
      });
      
    } catch (error) {
      log(`Error: ${error.message}`, 'error');
    }
  });

  // Check OpenAI Status
  document.getElementById('check-openai').addEventListener('click', async function() {
    clearLog();
    log('Checking OpenAI configuration...');
    
    try {
      const result = await chrome.storage.local.get(['settings']);
      if (result.settings && result.settings.openaiApiKey) {
        log('OpenAI API key is configured', 'success');
        log(`Key length: ${result.settings.openaiApiKey.length} characters`, 'success');
      } else {
        log('No OpenAI API key found', 'error');
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'error');
    }
  });

  // Ping Background Script
  document.getElementById('ping-background').addEventListener('click', function() {
    clearLog();
    log('Pinging background script...');
    
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        log(`Background script error: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        log('Background script responded successfully', 'success');
        if (response) {
          log(`Response: ${JSON.stringify(response)}`, 'success');
        }
      }
    });
  });

  // Test Summarize Request
  document.getElementById('test-summarize').addEventListener('click', async function() {
    clearLog();
    log('Testing summarize request...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        log('No active tab found', 'error');
        return;
      }
      
      chrome.runtime.sendMessage({
        type: 'SEND_MESSAGE',
        payload: {
          text: 'summarize this page',
          sessionId: 'debug-session',
          tabId: tab.id
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          log(`Summarize error: ${chrome.runtime.lastError.message}`, 'error');
        } else {
          log('Summarize request sent successfully', 'success');
          if (response) {
            log(`Response: ${JSON.stringify(response, null, 2)}`, 'success');
          }
        }
      });
      
    } catch (error) {
      log(`Error: ${error.message}`, 'error');
    }
  });

  // Test OpenAI Connection
  document.getElementById('test-openai').addEventListener('click', function() {
    clearLog();
    log('Testing OpenAI connection...');
    
    chrome.runtime.sendMessage({
      type: 'SEND_MESSAGE',
      payload: {
        text: 'Hello, this is a test message',
        sessionId: 'debug-session'
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        log(`OpenAI test error: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        log('OpenAI test message sent successfully', 'success');
        if (response && response.payload && response.payload.text) {
          log(`AI Response: ${response.payload.text}`, 'success');
        }
      }
    });
  });

  // Add new image testing functionality
  function addImageTesting() {
    const messageTestsSection = document.querySelector('.debug-section:nth-child(3)');
    
    // Add image test buttons
    const imageTestButton = document.createElement('button');
    imageTestButton.id = 'test-image-extraction';
    imageTestButton.textContent = 'Test Image Extraction';
    messageTestsSection.appendChild(imageTestButton);
    
    const postTestButton = document.createElement('button');
    postTestButton.id = 'test-post-extraction';
    postTestButton.textContent = 'Test Post Extraction';
    messageTestsSection.appendChild(postTestButton);
    
    // Test Image Extraction
    imageTestButton.addEventListener('click', async function() {
      clearLog();
      log('Testing image extraction...');
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          log('No active tab found', 'error');
          return;
        }
        
        if (!tab.url?.includes('xiaohongshu.com')) {
          log('Please navigate to a Xiaohongshu page first', 'error');
          return;
        }
        
        // Test image extraction
        chrome.tabs.sendMessage(tab.id, { type: 'TEST_IMAGE_EXTRACTION' }, (response) => {
          if (chrome.runtime.lastError) {
            log(`Error: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          
          if (response && response.images && response.images.length > 0) {
            log(`Found ${response.images.length} images:`, 'success');
            response.images.forEach((img, index) => {
              log(`Image ${index + 1}: ${img.url}`);
              log(`  Selector: ${img.selector}`);
              log(`  Dimensions: ${img.width}x${img.height}`);
            });
          } else {
            log('No images found', 'error');
          }
        });
        
      } catch (error) {
        log(`Error: ${error.message}`, 'error');
      }
    });
    
    // Test Post Extraction
    postTestButton.addEventListener('click', async function() {
      clearLog();
      log('Testing post extraction with images...');
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
          log('No active tab found', 'error');
          return;
        }
        
        if (!tab.url?.includes('xiaohongshu.com')) {
          log('Please navigate to a Xiaohongshu page first', 'error');
          return;
        }
        
        chrome.tabs.sendMessage(tab.id, { 
          type: 'EXTRACT_POSTS_ASYNC',
          payload: { maxPosts: 2, fetchFullContent: false }
        }, (response) => {
          if (chrome.runtime.lastError) {
            log(`Error: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          
          if (response && response.posts) {
            log(`Extracted ${response.posts.length} posts:`, 'success');
            response.posts.forEach((post, index) => {
              log(`\nPost ${index + 1}:`);
              log(`  Title: ${post.title}`);
              log(`  Content: ${post.content.slice(0, 100)}...`);
              log(`  Link: ${post.link || 'No link'}`);
              log(`  Image: ${post.image || 'No image'}`);
            });
          } else {
            log('No posts extracted', 'error');
          }
        });
        
      } catch (error) {
        log(`Error: ${error.message}`, 'error');
      }
    });
  }

  // Initialize image testing
  addImageTesting();
}); 