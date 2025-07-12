# MCP Integration & Migration Plan for ChatBrowse

## Current Architecture Overview

### Message Flow
```
User Input → Content Script → Background Script → MessageRouter 
    → Intent Classification → Service Layer → External APIs/Actions
```

### Key Components
1. **Background Script**: Central message hub
2. **MessageRouter**: Routes messages based on intent
3. **Service Layer**: 
   - LLMService (OpenAI, Bedrock, Inception)
   - NavigationService
   - SearchService
   - ActionService
   - ContextService
   - ExtractionService
4. **MCP Client**: Already exists for browser automation
5. **Content Script**: Handles page interactions

## Integration Strategy: Hybrid Approach

Rather than a complete replacement, we'll implement a **hybrid approach** that enhances the current system with MCP capabilities while maintaining backward compatibility.

### Phase 1: MCP Enhancement Layer (Weeks 1-2)

#### 1.1 Expand MCP Server Capabilities
The existing MCP server will be enhanced to expose all browser operations:

```typescript
// Current MCP Server (Limited)
{
  'browse_webpage': (url, selector?) => content
  'google_search': (query) => results
  'bilibili_search': (query) => results
  'xiaohongshu_search': (query) => results
}

// Enhanced MCP Server (Comprehensive)
{
  // Existing tools (backward compatible)
  'browse_webpage': ...,
  'google_search': ...,
  
  // New browser control tools
  'browser.navigate': ...,
  'browser.click': ...,
  'browser.type': ...,
  'browser.extract': ...,
  'browser.screenshot': ...,
  
  // New resources
  'browser://current-page': ...,
  'browser://tabs': ...,
  'browser://session': ...,
  
  // New prompts
  'browser.fillForm': ...,
  'browser.extractStructured': ...
}
```

#### 1.2 Create MCP Bridge Service
Add a new service to the existing service layer:

```typescript
// src/services/mcp-bridge-service.ts
export class MCPBridgeService {
  private mcpClient = mcpClient; // Existing MCP client
  
  // Bridge method that translates service calls to MCP
  async executeViaMCP(operation: string, params: any): Promise<any> {
    // Map internal operations to MCP tools
    const mcpMapping = {
      'navigate': 'browser.navigate',
      'extract': 'browser.extract',
      'click': 'browser.click',
      // ... more mappings
    };
    
    const mcpTool = mcpMapping[operation] || operation;
    return this.mcpClient.callTool(mcpTool, params);
  }
  
  // Expose MCP to external clients
  async handleExternalMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    // Validate permissions
    // Route to appropriate handler
    // Return MCP-compliant response
  }
}
```

### Phase 2: Service Layer Integration (Weeks 3-4)

#### 2.1 Gradual Service Migration
Each service will be updated to optionally use MCP:

```typescript
// Before: Direct Chrome API calls
export class NavigationService {
  async navigate(url: string, tabId?: number) {
    chrome.tabs.update(tabId, { url });
  }
}

// After: MCP-aware with fallback
export class NavigationService {
  constructor(private mcpBridge?: MCPBridgeService) {}
  
  async navigate(url: string, tabId?: number) {
    if (this.mcpBridge && CONFIG.useMCPForNavigation) {
      // Use MCP for navigation
      return this.mcpBridge.executeViaMCP('navigate', { url, tabId });
    } else {
      // Fallback to direct Chrome API
      chrome.tabs.update(tabId, { url });
    }
  }
}
```

#### 2.2 MessageRouter Enhancement
Update the MessageRouter to handle both traditional and MCP requests:

```typescript
export class MessageRouter {
  private mcpBridge = new MCPBridgeService();
  
  async route(request: any, sender: any, sendResponse: Function) {
    // Check if this is an MCP request
    if (request.type === 'MCP_REQUEST') {
      return this.handleMCPRequest(request, sender, sendResponse);
    }
    
    // Existing routing logic
    switch (request.type) {
      case 'SEND_MESSAGE':
        // Check if MCP routing is enabled for this intent
        if (CONFIG.mcpEnabledIntents.includes(intent)) {
          return this.routeViaMCP(request, intent, sendResponse);
        }
        // Fall back to traditional routing
        return this.handleUserMessage(request.payload, sender, sendResponse);
      // ... rest of existing cases
    }
  }
}
```

### Phase 3: Content Script Enhancement (Weeks 5-6)

#### 3.1 MCP-Aware Content Script
Enhance content script to support MCP operations:

```typescript
class ContentScript {
  private mcpOperations: MCPOperations;
  
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Handle MCP operations
      if (request.type === 'MCP_EXECUTE') {
        return this.executeMCPOperation(request.operation, request.params, sendResponse);
      }
      
      // Existing message handling
      switch (request.type) {
        // ... existing cases
      }
    });
  }
  
  async executeMCPOperation(operation: string, params: any, sendResponse: Function) {
    // Execute browser operations for MCP
    switch (operation) {
      case 'findElements':
        const elements = this.pageAnalyzer.findElements(params);
        sendResponse({ success: true, elements });
        break;
      case 'extractStructured':
        const data = await this.extractStructuredData(params);
        sendResponse({ success: true, data });
        break;
      // ... more operations
    }
  }
}
```

### Phase 4: External MCP Interface (Weeks 7-8)

#### 4.1 MCP Server Enhancement
Update the native MCP server to communicate with the extension:

```javascript
// mcp-server/src/index.ts
class ChatBrowseMCPServer {
  async handleToolCall(tool, params) {
    switch (tool) {
      case 'browser.navigate':
        // Send to extension via native messaging
        return this.sendToExtension('NAVIGATE', params);
        
      case 'browser.extract':
        // Complex extraction via extension
        return this.sendToExtension('EXTRACT', params);
        
      // New composite tools
      case 'browser.fillForm':
        // Multi-step operation
        const form = await this.sendToExtension('ANALYZE_FORM', params);
        const filled = await this.fillWithAI(form, params.data);
        return this.sendToExtension('FILL_FORM', filled);
    }
  }
}
```

#### 4.2 Bidirectional Communication
Enable the extension to call back to MCP server:

```typescript
// src/mcp-client.ts
class EnhancedMCPClient {
  // Existing methods...
  
  // New: Extension can register as MCP provider
  async registerAsProvider(capabilities: MCPCapabilities) {
    this.port.postMessage({
      method: 'register',
      params: { capabilities }
    });
  }
  
  // New: Handle incoming MCP requests
  onMCPRequest(callback: (request: MCPRequest) => Promise<MCPResponse>) {
    this.port.onMessage.addListener(async (message) => {
      if (message.type === 'mcp_request') {
        const response = await callback(message.request);
        this.port.postMessage({
          method: 'response',
          id: message.id,
          result: response
        });
      }
    });
  }
}
```

## Migration Path

### Stage 1: Parallel Systems (Month 1)
- ✅ Existing functionality unchanged
- ✅ MCP enhancements run in parallel
- ✅ Feature flags control MCP usage
- ✅ A/B testing of MCP vs traditional

### Stage 2: Gradual Adoption (Month 2)
- Enable MCP for specific operations (navigation, extraction)
- Monitor performance and reliability
- Gather user feedback
- Fix integration issues

### Stage 3: MCP Primary (Month 3)
- MCP becomes primary for supported operations
- Traditional methods remain as fallback
- External MCP clients can connect
- Full MCP tool catalog available

### Stage 4: Full Integration (Month 4+)
- All operations available via MCP
- Legacy code refactored/removed where appropriate
- ChatBrowse recognized as standard MCP browser provider
- Community contributions enabled

## Configuration Management

```typescript
// src/config/mcp-config.ts
export const MCPConfig = {
  // Feature flags
  enabled: true,
  useMCPForNavigation: false,  // Gradual rollout
  useMCPForExtraction: true,
  useMCPForActions: false,
  
  // Performance settings
  mcpTimeout: 30000,
  fallbackToTraditional: true,
  
  // Security
  allowExternalMCP: false,  // Initially internal only
  mcpPermissions: {
    navigation: ['internal', 'trusted'],
    extraction: ['all'],
    actions: ['internal']
  }
};
```

## Benefits of This Approach

### 1. **No Breaking Changes**
- Existing users see no disruption
- All current features continue working
- Gradual adoption reduces risk

### 2. **Progressive Enhancement**
- Start with low-risk operations (extraction)
- Build confidence before critical operations
- Easy rollback if issues arise

### 3. **Unified Architecture**
- Single codebase serves both traditional and MCP
- Shared business logic
- Consistent user experience

### 4. **Future-Proof**
- Ready for MCP ecosystem growth
- Can expose new capabilities easily
- Community can contribute tools

## Technical Considerations

### 1. **Performance**
- MCP adds overhead (native messaging)
- Implement caching for frequent operations
- Batch operations where possible

### 2. **Error Handling**
```typescript
async function withMCPFallback<T>(
  mcpOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>
): Promise<T> {
  try {
    if (MCPConfig.enabled) {
      return await mcpOperation();
    }
  } catch (error) {
    console.warn('MCP operation failed, using fallback:', error);
    if (MCPConfig.fallbackToTraditional) {
      return await fallbackOperation();
    }
    throw error;
  }
  return fallbackOperation();
}
```

### 3. **Testing Strategy**
- Unit tests for both MCP and traditional paths
- Integration tests with MCP server
- E2E tests for full workflows
- Performance benchmarks

## Success Metrics

### Technical Metrics
- MCP operation success rate > 99%
- Performance overhead < 10%
- Zero breaking changes
- 100% feature parity

### Adoption Metrics
- Internal MCP usage > 50% after 2 months
- External MCP client connections
- Community tool contributions
- User satisfaction maintained/improved

## Rollback Plan

If issues arise:
1. Disable MCP via feature flags (immediate)
2. Route all operations through traditional path
3. Debug issues in staging environment
4. Fix and re-enable gradually

## Conclusion

This hybrid integration approach allows ChatBrowse to:
- Maintain all existing functionality
- Gradually adopt MCP benefits
- Become a leader in the MCP ecosystem
- Enable powerful new use cases

The key is gradual migration with careful monitoring, allowing us to realize MCP's benefits while maintaining stability and user trust. 