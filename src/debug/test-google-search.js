/**
 * Test script to verify Google search response delivery
 * Run this in the browser console to test the fixed tab ID management
 */

function testGoogleSearchResponseFlow() {
  console.log('🧪 Starting Google Search Response Flow Test...');
  
  // Get current tab info
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  const currentTabId = 'current-tab'; // Will be filled by background
  
  console.log('📋 Current tab info:', {
    url: currentUrl,
    title: currentTitle
  });
  
  // Test payload - simulating "google 口袋黄" command
  const testPayload = {
    text: 'google 口袋黄',
    sessionId: 'test-session-' + Date.now(),
    tabId: undefined,
    tabUrl: currentUrl,
    tabTitle: currentTitle
  };
  
  console.log('📤 Sending test Google search request...');
  console.log('📋 Test payload:', testPayload);
  
  // Track responses received
  let responseCount = 0;
  const expectedResponses = [
    'Searching google for',
    'Successfully navigated to google',
    'Extracting search results',
    'Google Search Results for',
    'AI Analysis of Google Search Results'
  ];
  
  // Send the message and track responses
  chrome.runtime.sendMessage({
    type: 'SEND_MESSAGE',
    payload: testPayload
  }, (response) => {
    responseCount++;
    console.log(`📨 Response ${responseCount} received:`, response);
    
    if (response && response.type === 'MESSAGE') {
      const text = response.payload.text;
      console.log(`✅ Response ${responseCount} type: MESSAGE`);
      console.log(`📝 Response ${responseCount} text:`, text.substring(0, 100) + '...');
      
      // Check which expected response this matches
      const matchedResponse = expectedResponses.find(expected => 
        text.toLowerCase().includes(expected.toLowerCase())
      );
      
      if (matchedResponse) {
        console.log(`🎯 Response ${responseCount} matches: "${matchedResponse}"`);
      } else {
        console.log(`❓ Response ${responseCount} doesn't match expected patterns`);
      }
      
    } else if (response && response.type === 'ERROR') {
      console.log(`❌ Response ${responseCount} type: ERROR`);
      console.log(`💥 Error message:`, response.payload?.message);
    } else {
      console.log(`⚠️ Response ${responseCount} unexpected format:`, response);
    }
  });
  
  console.log('⏳ Request sent, monitoring for responses...');
  console.log('📊 Expected responses:', expectedResponses);
  console.log('🔍 Check console for detailed response tracking');
  
  // Also set up a listener for additional responses that might come via direct messaging
  let directResponseCount = 0;
  const messageListener = (request, sender, sendResponse) => {
    if (request.type === 'MESSAGE' && request.payload?.sessionId === testPayload.sessionId) {
      directResponseCount++;
      console.log(`📨 Direct response ${directResponseCount} received:`, request);
      console.log(`📝 Direct response ${directResponseCount} text:`, 
        request.payload.text.substring(0, 100) + '...');
    }
  };
  
  chrome.runtime.onMessage.addListener(messageListener);
  
  // Clean up listener after 30 seconds
  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(messageListener);
    console.log('🧹 Test completed, message listener removed');
    console.log(`📊 Total callback responses: ${responseCount}`);
    console.log(`📊 Total direct responses: ${directResponseCount}`);
    console.log(`📊 Total responses: ${responseCount + directResponseCount}`);
  }, 30000);
}

// Auto-run if this script is loaded directly
if (typeof window !== 'undefined' && window.location) {
  console.log('🚀 Google Search Response Flow Test ready');
  console.log('💡 Run testGoogleSearchResponseFlow() to start the test');
} 