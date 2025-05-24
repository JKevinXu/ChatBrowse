/**
 * Process user command
 * This is a simple implementation that can be extended with NLP capabilities
 */
export function processCommand(text: string): { command: string; args: string } {
  const lowerText = text.toLowerCase().trim();
  
  // Simple command detection
  if (lowerText.startsWith('go to ') || lowerText.startsWith('navigate to ')) {
    const url = lowerText.replace(/^(go to|navigate to)\s+/i, '').trim();
    return { command: 'navigate', args: url };
  }
  
  if (lowerText.startsWith('find ') || lowerText.includes('search for ')) {
    const query = lowerText.replace(/^find\s+/i, '')
      .replace(/search for\s+/i, '').trim();
    return { command: 'search', args: query };
  }
  
  if (lowerText.includes('extract') || lowerText.includes('get info')) {
    return { command: 'extract', args: '' };
  }
  
  // Process set context command
  if (lowerText.startsWith('set context') || lowerText.startsWith('use context') || 
      lowerText.startsWith('context on') || lowerText.startsWith('enable context')) {
    const args = 'on';
    return { command: 'setcontext', args };
  }
  
  if (lowerText.startsWith('disable context') || lowerText.startsWith('context off') || 
      lowerText.startsWith('remove context')) {
    const args = 'off';
    return { command: 'setcontext', args };
  }
  
  // Default to general chat
  return { command: 'chat', args: text };
} 