# LLM-Based Intent Classification

## Overview

The ChatBrowse extension uses **LLM-powered intent classification** to understand user requests intelligently. The system requires a configured LLM provider and will throw errors if the LLM is unavailable.

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

The system classifies user input into these categories:

| Intent | Description | Examples |
|--------|-------------|----------|
| `action_execution` | Execute a previously planned action | "do it", "execute the plan", "go ahead" |
| `navigation` | Navigate to URLs or platforms | "go to google.com", "login to xiaohongshu" |
| `search` | Search on specific platforms | "search google for cats", "find videos on bilibili" |
| `xiaohongshu_summary` | Summarize Xiaohongshu content | "summarize xiaohongshu posts about travel" |
| `xiaohongshu_extract` | Extract Xiaohongshu posts | "extract posts from this page" |
| `action_planning` | Plan actions on current page | "help me find products", "search for something" |
| `general_chat` | General conversation | "what's the weather?", "tell me a joke" |

## Architecture

### Core Components

```typescript
// LLM-based intent service (no fallback)
IntentService.classifyIntent(text: string, context?: {
  currentUrl?: string;
  hasStoredActionPlan?: boolean;
  pageTitle?: string;
}): Promise<IntentResult>

// Intent result with rich information
interface IntentResult {
  intent: string;
  confidence: number;
  parameters?: { [key: string]: any };
  reasoning?: string;
}
```

### Integration Flow

```
User Input → IntentService → LLM Classification → MessageRouter → Action Handler
                    ↓
              [If LLM fails]
                    ↓
            Throw Error → Return Error Response
```

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

## Configuration

**IMPORTANT**: The system requires LLM configuration to function:

1. **OpenAI Configuration**: Requires valid API key in extension settings
2. **AWS Bedrock Configuration**: Requires valid AWS credentials and region

### Error Handling

- If no LLM provider is configured → Throws error
- If LLM request fails → Throws error  
- If LLM response is invalid → Throws error

The extension will display error messages to users when LLM is unavailable.

## Migration Notes

- **Removed fallback classification**: System no longer falls back to rule-based patterns
- **LLM dependency**: Extension now requires working LLM configuration
- **Consistent behavior**: All intent classification uses the same intelligent approach

## Performance

- **Latency**: ~200-500ms for LLM classification (vs ~1ms rule-based)
- **Accuracy**: Significantly improved for natural language variations
- **Reliability**: 100% uptime with fallback system
- **Cost**: Minimal token usage (~50-100 tokens per classification)

## Usage in Code

### Basic Classification
```typescript
import { IntentService } from './services/intent-service';

const intentService = IntentService.getInstance();
const result = await intentService.classifyIntent("search for cats");

console.log(result.intent);      // "search"
console.log(result.confidence);  // 0.85
console.log(result.parameters);  // { query: "cats", engine: "general" }
```

### With Context
```typescript
const result = await intentService.classifyIntent("do it", {
  currentUrl: "https://youtube.com",
  hasStoredActionPlan: true,
  pageTitle: "YouTube"
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