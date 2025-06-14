/**
 * Comprehensive diagnostic script for Google search response flow
 * Run this in the browser console to identify where responses are getting lost
 */

function diagnoseResponseFlow() {
  console.log('🔬 Starting Comprehensive Response Flow Diagnosis...');
  console.log('=' .repeat(60));
  
  // Step 1: Check current environment
  console.log('📊 STEP 1: Environment Check');
  console.log('  Current URL:', window.location.href);
  console.log('  Page Title:', document.title);
  console.log('  Chrome Extension Available:', !!chrome?.runtime);
  console.log('  Content Script Present:', !!window.ChatBrowse);
  
  // Step 2: Test message sending capability
  console.log('\n📊 STEP 2: Testing Message Send Capability');
  
  const testSessionId = 'diagnosis-' + Date.now();
  
  // Create promise to track response
  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout after 30 seconds'));
    }, 30000);
    
    let responseCount = 0;
    const responses = [];
    
    // Test the primary callback mechanism
    chrome.runtime.sendMessage({
      type: 'SEND_MESSAGE',
      payload: {
        text: 'google test diagnosis',
        sessionId: testSessionId,
        tabId: undefined,
        tabUrl: window.location.href,
        tabTitle: document.title
      }
    }, (response) => {
      responseCount++;
      console.log(`📨 CALLBACK Response ${responseCount}:`, response);
      
      if (response) {
        responses.push({
          source: 'callback',
          response: response,
          timestamp: Date.now()
        });
        
        if (response.type === 'MESSAGE') {
          console.log(`✅ Callback Response ${responseCount} - Valid MESSAGE type`);
          console.log(`📝 Text Preview:`, response.payload?.text?.substring(0, 100) + '...');
        } else {
          console.log(`⚠️ Callback Response ${responseCount} - Unexpected type: ${response.type}`);
        }
      } else {
        console.log(`❌ Callback Response ${responseCount} - NULL response`);
      }
      
      // Don't resolve yet, wait for potential additional responses
    });
    
    // Set up listener for direct tab messages
    let directResponseCount = 0;
    const messageListener = (request, sender, sendResponse) => {
      if (request.type === 'MESSAGE' && request.payload?.sessionId === testSessionId) {
        directResponseCount++;
        console.log(`📨 DIRECT Response ${directResponseCount}:`, request);
        
        responses.push({
          source: 'direct',
          response: request,
          timestamp: Date.now()
        });
        
        console.log(`✅ Direct Response ${directResponseCount} - MESSAGE received`);
        console.log(`📝 Text Preview:`, request.payload?.text?.substring(0, 100) + '...');
        
        sendResponse({ received: true });
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Check for responses after various time intervals
    setTimeout(() => {
      console.log(`📊 5-second check: ${responseCount} callback responses, ${directResponseCount} direct responses`);
    }, 5000);
    
    setTimeout(() => {
      console.log(`📊 10-second check: ${responseCount} callback responses, ${directResponseCount} direct responses`);
    }, 10000);
    
    setTimeout(() => {
      console.log(`📊 15-second check: ${responseCount} callback responses, ${directResponseCount} direct responses`);
    }, 15000);
    
    // Final resolution after 25 seconds
    setTimeout(() => {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(messageListener);
      
      console.log('\n📊 FINAL RESULTS:');
      console.log(`  Total Callback Responses: ${responseCount}`);
      console.log(`  Total Direct Responses: ${directResponseCount}`);
      console.log(`  Total Responses: ${responseCount + directResponseCount}`);
      console.log('\n📋 Response Timeline:');
      
      responses.forEach((resp, index) => {
        const timeDiff = index === 0 ? 0 : resp.timestamp - responses[0].timestamp;
        console.log(`  ${index + 1}. [+${timeDiff}ms] ${resp.source.toUpperCase()}: ${resp.response.payload?.text?.substring(0, 50)}...`);
      });
      
      if (responses.length === 0) {
        console.log('❌ CRITICAL: No responses received at all!');
        console.log('🔍 This indicates a fundamental issue with the response mechanism');
      } else if (responseCount > 0 && directResponseCount === 0) {
        console.log('✅ Callback responses working, direct messaging not needed');
      } else if (responseCount === 0 && directResponseCount > 0) {
        console.log('⚠️ Only direct responses working, callback mechanism failing');
      } else if (responseCount > 0 && directResponseCount > 0) {
        console.log('✅ Both callback and direct response mechanisms working');
      }
      
      resolve({ responseCount, directResponseCount, responses });
    }, 25000);
  });
  
  console.log('\n⏳ Diagnosis in progress...');
  console.log('📊 Monitoring for 25 seconds...');
  console.log('🔍 Check console for real-time updates');
  
  return responsePromise;
}

// Step 3: Content script presence check
function checkContentScriptStatus() {
  console.log('\n📊 STEP 3: Content Script Status Check');
  
  // Check if ChatBrowse content script is loaded
  const hasChatBrowse = !!window.ChatBrowse;
  console.log('  ChatBrowse Global:', hasChatBrowse);
  
  // Check for chat UI elements
  const chatContainer = document.querySelector('[data-chatbrowse]');
  const chatUI = document.querySelector('.chatbrowse-container');
  console.log('  Chat Container Found:', !!chatContainer);
  console.log('  Chat UI Found:', !!chatUI);
  
  // Test message listener by sending a direct message
  if (chrome?.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'MESSAGE', 
          payload: { 
            text: 'Content script test message', 
            sessionId: 'test-' + Date.now() 
          } 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('  Content Script Communication: ❌ FAILED');
            console.log('  Error:', chrome.runtime.lastError.message);
          } else {
            console.log('  Content Script Communication: ✅ SUCCESS');
            console.log('  Response:', response);
          }
        });
      }
    });
  }
}

// Auto-run diagnosis
if (typeof window !== 'undefined' && window.location) {
  console.log('🔬 Google Search Response Flow Diagnostics Ready');
  console.log('💡 Run diagnoseResponseFlow() to start comprehensive diagnosis');
  console.log('💡 Run checkContentScriptStatus() to check content script status');
} 