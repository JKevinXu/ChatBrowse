// Debug page for ChatBrowse extension

// DOM elements
const statusDisplay = document.getElementById('status-display') as HTMLDivElement;
const checkStatusBtn = document.getElementById('check-status') as HTMLButtonElement;
const checkOpenAIBtn = document.getElementById('check-openai') as HTMLButtonElement;
const pingBackgroundBtn = document.getElementById('ping-background') as HTMLButtonElement;
const testSummarizeBtn = document.getElementById('test-summarize') as HTMLButtonElement;
const testOpenAIBtn = document.getElementById('test-openai') as HTMLButtonElement;

// Status check functions
function updateStatus(message: string, isError = false) {
  statusDisplay.innerHTML += `\n${new Date().toLocaleTimeString()}: ${message}`;
  statusDisplay.scrollTop = statusDisplay.scrollHeight;
  
  if (isError) {
    statusDisplay.innerHTML = statusDisplay.innerHTML.replace(message, `<span class="error">${message}</span>`);
  } else {
    statusDisplay.innerHTML = statusDisplay.innerHTML.replace(message, `<span class="success">${message}</span>`);
  }
}

function clearStatus() {
  statusDisplay.textContent = '';
}

// Check if the extension is loaded properly
function checkExtensionStatus() {
  clearStatus();
  updateStatus('Checking extension status...');
  
  try {
    // Check if we can communicate with the background script
    chrome.runtime.sendMessage({ type: 'PING', payload: { time: Date.now() } }, response => {
      if (chrome.runtime.lastError) {
        updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
        return;
      }
      
      if (response && response.received) {
        updateStatus('✅ Background script is running and responding');
        if (response.payload) {
          updateStatus(`Background info: ${JSON.stringify(response.payload)}`);
        }
      } else {
        updateStatus('❌ Unexpected response from background script', true);
      }
    });
  } catch (error) {
    updateStatus(`❌ Error checking extension status: ${error}`, true);
  }
}

// Check OpenAI status
function checkOpenAIStatus() {
  updateStatus('Checking OpenAI connection status...');
  
  chrome.runtime.sendMessage({ type: 'CHECK_OPENAI_STATUS' }, response => {
    if (chrome.runtime.lastError) {
      updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
      return;
    }
    
    if (response && response.status) {
      if (response.status === 'initialized') {
        updateStatus('✅ OpenAI is initialized');
      } else {
        updateStatus(`❌ OpenAI status: ${response.status}`, true);
      }
      
      if (response.message) {
        updateStatus(`📌 Info: ${response.message}`);
      }
    } else {
      updateStatus('❌ Could not determine OpenAI status', true);
    }
  });
}

// Ping the background script
function pingBackgroundScript() {
  updateStatus('Pinging background script...');
  
  chrome.runtime.sendMessage({ 
    type: 'PING',
    payload: { 
      time: Date.now(),
      source: 'debug page'
    } 
  }, response => {
    if (chrome.runtime.lastError) {
      updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
      return;
    }
    
    if (response) {
      updateStatus(`✅ Background script responded: ${JSON.stringify(response)}`);
    } else {
      updateStatus('❌ No response from background script', true);
    }
  });
}

// Test summarize request
function testSummarizeRequest() {
  updateStatus('Testing summarize request to background script...');
  
  chrome.runtime.sendMessage({
    type: 'SEND_MESSAGE',
    payload: {
      text: 'Please summarize this page',
      sessionId: 'debug-session-' + Date.now()
    }
  }, response => {
    if (chrome.runtime.lastError) {
      updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
      return;
    }
    
    if (response && response.type === 'MESSAGE') {
      updateStatus('✅ Summarize request successful');
      updateStatus(`Response: ${response.payload.text}`);
    } else {
      updateStatus('❌ Unexpected response for summarize request', true);
      updateStatus(`Response: ${JSON.stringify(response)}`);
    }
  });
}

// Test direct OpenAI call
function testOpenAIConnection() {
  updateStatus('Testing direct OpenAI connection...');
  
  chrome.runtime.sendMessage({
    type: 'TEST_OPENAI',
    payload: {
      prompt: 'Say hello from the debug page'
    }
  }, response => {
    if (chrome.runtime.lastError) {
      updateStatus(`Error: ${chrome.runtime.lastError.message}`, true);
      return;
    }
    
    if (response && response.success) {
      updateStatus('✅ OpenAI test successful');
      updateStatus(`Response: ${response.response}`);
    } else {
      updateStatus('❌ OpenAI test failed', true);
      if (response && response.error) {
        updateStatus(`Error: ${response.error}`);
      }
    }
  });
}

// Set up event listeners
function initDebugPage() {
  checkStatusBtn.addEventListener('click', checkExtensionStatus);
  checkOpenAIBtn.addEventListener('click', checkOpenAIStatus);
  pingBackgroundBtn.addEventListener('click', pingBackgroundScript);
  testSummarizeBtn.addEventListener('click', testSummarizeRequest);
  testOpenAIBtn.addEventListener('click', testOpenAIConnection);
  
  // Initial status check
  checkExtensionStatus();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initDebugPage);

// Self-check that the debug script is loaded
console.log('ChatBrowse debug script loaded successfully');
updateStatus('Debug page loaded successfully'); 