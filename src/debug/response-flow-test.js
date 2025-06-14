/**
 * Debug script to test the response flow for general chat requests
 * Run this in the browser console to trace the entire flow
 */

function testResponseFlow() {
  console.log('🚀 Starting Response Flow Debug Test...');
  
  // Simulate a "google pokemon" request
  const testPayload = {
    text: 'google pokemon',
    sessionId: 'test-session-' + Date.now(),
    tabId: undefined,
    tabUrl: window.location.href,
    tabTitle: document.title
  };
  
  console.log('📋 Test payload:', testPayload);
  
  // Send the message and track the response
  chrome.runtime.sendMessage({
    type: 'SEND_MESSAGE',
    payload: testPayload
  }, (response) => {
    console.log('📨 Response received in test:', response);
    
    if (response) {
      console.log('✅ Response type:', response.type);
      console.log('📝 Response payload:', response.payload);
      
      if (response.type === 'MESSAGE' && response.payload?.text) {
        console.log('🎉 SUCCESS: Response contains text!');
        console.log('📄 Response text length:', response.payload.text.length);
        console.log('📄 Response text preview:', response.payload.text.substring(0, 200) + '...');
      } else if (response.type === 'ERROR') {
        console.log('❌ ERROR: Received error response');
        console.log('💥 Error message:', response.payload?.message);
      } else {
        console.log('⚠️ UNEXPECTED: Response format not as expected');
      }
    } else {
      console.log('❌ PROBLEM: No response received');
      console.log('🔍 Check if there were any errors in the background script');
    }
  });
  
  console.log('⏳ Request sent, waiting for response...');
  console.log('📊 Check the background script logs for detailed flow tracing');
}

// Auto-run the test
testResponseFlow();

// Export for manual testing
window.testResponseFlow = testResponseFlow; 