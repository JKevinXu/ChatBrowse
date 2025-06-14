# LLM-Based Intent Classification

## Overview

The ChatBrowse extension uses **LLM-powered intent classification** to understand user requests intelligently. The system requires a configured LLM provider and will throw errors if the LLM is unavailable.

**🎯 Centralized Configuration**: All intent definitions are now managed in `/src/config/intent-config.ts` for consistency and maintainability.

## Key Features

### 🧠 **Intelligent Understanding**
- Natural language understanding that handles variations, politeness, and context
- Flexible command interpretation beyond rigid keyword matching

### 📊 **Confidence Scoring** 
- Each classification comes with a confidence score (0.0-1.0)
- Provides reasoning for each classification decision

### 🔧 **Better Parameter Extraction**
- Automatically extracts search queries, URLs, and platform names
- Handles complex sentence structures
- Provides reasoning for each classification decision

### ⚡ **LLM-Only Approach**
- **Requires LLM configuration**: OpenAI or AWS Bedrock must be configured
- **No fallback**: If LLM is unavailable, the system will return errors
- **Consistent behavior**: All classifications use the same intelligent approach

## Intent Types

The system classifies user input into these categories (defined in `src/config/intent-config.ts`):

| Intent | Description | Examples |
|--------|-------------|----------|
| `action_execution` | Execute a previously planned action | "do it", "execute the plan", "go ahead" |
| `navigation` | Navigate to URLs or platforms | "go to google.com", "login to xiaohongshu" |
| `search` | Search on specific platforms | "search google for cats", "find videos on bilibili" |
| `xiaohongshu_summary` | Summarize Xiaohongshu content | "summarize xiaohongshu posts about travel" |
| `xiaohongshu_extract` | Extract Xiaohongshu posts | "extract posts from this page" |
| `action_planning` | Plan specific UI actions on current page | "click bulk actions", "download data", "select items", "fill out the form" |
| `general_chat` | General conversation, questions, and content requests | "what's the weather?", "summarize the page", "explain this content" |

### Intent Classification Rules

The classification rules and distinctions are automatically generated from the centralized configuration:

#### **action_planning vs general_chat**
- **`action_planning`**: Only for specific UI interactions
  - ✅ "click the submit button"
  - ✅ "download the data" 
  - ✅ "select all items"
  - ✅ "fill out this form"

- **`general_chat`**: For content analysis and general requests
  - ✅ "summarize the page"
  - ✅ "explain this content"
  - ✅ "what does this mean?"
  - ✅ "tell me about this page"

#### **xiaohongshu_summary vs general_chat**
- **`xiaohongshu_summary`**: Platform-specific content analysis
  - ✅ "summarize xiaohongshu posts about travel"
  - ✅ "analyze xiaohongshu fashion content"

- **`general_chat`**: General page summarization
  - ✅ "summarize the page" (on any website)
  - ✅ "what's on this page?"

## Architecture

### Core Components

```typescript
// Centralized intent configuration
import { IntentType, IntentConfig, INTENT_DEFINITIONS } from '../config/intent-config';

// LLM-based intent service (no fallback)
IntentService.classifyIntent(text: string, context?: {
  currentUrl?: string;
  hasStoredActionPlan?: boolean;
  pageTitle?: string;
}): Promise<IntentResult>

// Intent result with rich information
interface IntentResult {
  intent: IntentType;  // Now derived from centralized config
  confidence: number;
  parameters?: { [key: string]: any };
  reasoning?: string;
}
```

### Centralized Configuration

```typescript
// src/config/intent-config.ts
export const INTENT_DEFINITIONS: Record<string, IntentDefinition> = {
  action_execution: {
    id: 'action_execution',
    name: 'Action Execution', 
    description: 'User wants to execute a previously planned action',
    examples: ['do it', 'execute', 'run it', 'go ahead', 'proceed'],
    requiresContext: ['hasStoredActionPlan']
  },
  // ... other intents
};

// Utility functions for configuration management
export class IntentConfig {
  static getIntentDefinition(intentId: string): IntentDefinition | undefined
  static isValidIntent(intent: string): intent is IntentType
  static generateLLMPromptSection(): string
  static generateIntentDistinctions(): string
}
```

### Integration Flow

```
User Input → IntentService → LLM Classification → MessageRouter → Action Handler
                    ↓                              ↓
              [Uses centralized              [Uses centralized
               configuration]                configuration for routing]
                    ↓
            [If LLM fails]
                    ↓
            Throw Error → Return Error Response
```

## Benefits of Centralized Configuration

### 🔧 **Maintainability**
- Single source of truth for all intent definitions
- Changes only need to be made in one place
- Automatic synchronization across all components

### 📋 **Consistency**
- TypeScript types derived from configuration
- LLM prompts generated from configuration  
- Validation logic uses same definitions
- Message routing uses same intent types

### 🧪 **Testing**
- Demo tests automatically generated from configuration
- No need to manually update test cases when intents change
- Comprehensive coverage of all defined intents

### 🔄 **Extensibility**
- Easy to add new intents by updating configuration
- All components automatically pick up new intents
- No need to modify multiple files for new intents

## Examples

### Natural Language Variations
```javascript
// All of these work with LLM classification:
"search google for cats"           // Direct command ✅
"could you search google for cats?" // Polite request ✅
"I want to find cats on google"    // Natural language ✅
"please help me search for cats"   // Help-seeking language ✅
```

### Context-Aware Classification
```javascript
// With stored action plan
classifyIntent("do it", { hasStoredActionPlan: true })
// → { intent: "action_execution", confidence: 0.95 }

// Without stored action plan  
classifyIntent("do it", { hasStoredActionPlan: false })
// → { intent: "general_chat", confidence: 0.6 }
```

### Parameter Extraction
```javascript
classifyIntent("search bilibili for cooking videos")
// → {
//     intent: "search",
//     confidence: 0.92,
//     parameters: {
//       query: "cooking videos",
//       engine: "bilibili"
//     },
//     reasoning: "User wants to search for content on bilibili platform"
//   }
```

## Configuration Management

### Adding New Intents

To add a new intent, simply update `src/config/intent-config.ts`:

```typescript
export const INTENT_DEFINITIONS: Record<string, IntentDefinition> = {
  // ... existing intents
  
  new_intent: {
    id: 'new_intent',
    name: 'New Intent',
    description: 'Description of what this intent handles',
    examples: ['example command 1', 'example command 2'],
    chineseExamples: ['中文例子'],  // Optional
    parameters: ['param1', 'param2'],  // Optional
    requiresContext: ['contextField']   // Optional
  }
};
```

Then add the handler in MessageRouter:

```typescript
private async routeToIntentHandler(intentResult: IntentResult, ...): Promise<boolean> {
  switch (intentResult.intent) {
    // ... existing cases
    
    case 'new_intent':
      console.log('🆕 [MessageRouter] CASE: new_intent');
      await this.newIntentService.handleNewIntent(text, tabId, sendResponse, sessionId);
      return true;
  }
}
```

### Modifying Existing Intents

Simply update the relevant entry in `INTENT_DEFINITIONS`. All components will automatically use the updated configuration.

## Error Handling

**IMPORTANT**: The system requires LLM configuration to function:

1. **OpenAI Configuration**: Requires valid API key in extension settings
2. **AWS Bedrock Configuration**: Requires valid AWS credentials and region

### Error Handling

- If no LLM provider is configured → Throws error
- If LLM request fails → Throws error  
- If LLM response is invalid → Throws error
- If intent not found in configuration → Falls back to `general_chat`

The extension will display error messages to users when LLM is unavailable.

## Performance

- **Latency**: ~200-500ms for LLM classification
- **Accuracy**: Significantly improved for natural language variations
- **Consistency**: 100% consistent across all components
- **Cost**: Minimal token usage (~50-100 tokens per classification)

## Usage in Code

### Basic Classification
```typescript
import { IntentService } from './services/intent-service';
import { IntentConfig } from './config/intent-config';

const intentService = IntentService.getInstance();
const result = await intentService.classifyIntent("search for cats");

console.log(result.intent);      // "search"
console.log(result.confidence);  // 0.85
console.log(result.parameters);  // { query: "cats", engine: "general" }

// Validate intent using centralized config
if (IntentConfig.isValidIntent(result.intent)) {
  const definition = IntentConfig.getIntentDefinition(result.intent);
  console.log(definition.description);
}
```

### With Context
```typescript
const result = await intentService.classifyIntent("do it", {
  hasStoredActionPlan: true,
  currentUrl: "https://example.com",
  pageTitle: "Example Page"
});
```

## Testing

Run the demo to see the system in action:

```typescript
import { runIntentDemo } from './demo/intent-demo';
await runIntentDemo();
```

This will test various input patterns and compare LLM vs rule-based results.

## Benefits for Users

- 🗣️ **Natural conversation**: Speak to the extension like a human
- 🎯 **Better accuracy**: Fewer misunderstood commands
- 🔄 **Flexible phrasing**: Multiple ways to say the same thing
- 📝 **Clear feedback**: See why the system interpreted your request a certain way
- 🛡️ **Always works**: Fallback ensures reliability

## Future Enhancements

- **Learning from corrections**: User feedback to improve classification
- **Multi-language support**: Intent classification in different languages  
- **Custom intents**: User-defined intent categories
- **Conversation memory**: Multi-turn intent understanding 