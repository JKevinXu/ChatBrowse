import { LLMService } from './llm-service';
import { ConfigService } from './config-service';

export interface IntentResult {
  intent: 'action_execution' | 'navigation' | 'search' | 'xiaohongshu_summary' | 'xiaohongshu_extract' | 'action_planning' | 'general_chat';
  confidence: number;
  parameters?: {
    [key: string]: any;
  };
  reasoning?: string;
}

export interface SearchIntent {
  query: string;
  engine: 'google' | 'bilibili' | 'xiaohongshu' | 'general';
}

export interface NavigationIntent {
  url?: string;
  platform?: string;
  action?: string;
}

export class IntentService {
  private static instance: IntentService;
  private llmService = LLMService.getInstance();
  private configService = ConfigService.getInstance();

  private constructor() {}

  static getInstance(): IntentService {
    if (!IntentService.instance) {
      IntentService.instance = new IntentService();
    }
    return IntentService.instance;
  }

  async classifyIntent(text: string, context?: {
    currentUrl?: string;
    hasStoredActionPlan?: boolean;
    pageTitle?: string;
  }): Promise<IntentResult> {
    console.log('🎯 [IntentService] Starting intent classification');
    console.log('📝 [IntentService] Input text:', JSON.stringify(text));
    console.log('🌐 [IntentService] Context:', JSON.stringify(context));

    try {
      const llmSettings = await this.configService.getLLMSettings();
      const provider = llmSettings.provider;
      
      console.log('⚙️ [IntentService] LLM provider:', provider);

      // Check if LLM is available
      console.log('🔍 [IntentService] Checking if LLM provider is available...');
      const isAvailable = await this.isProviderAvailable(provider);
      console.log('✅ [IntentService] LLM provider available:', isAvailable);
      
      if (!isAvailable) {
        console.log('⚠️ [IntentService] LLM not available, falling back to rule-based classification');
        const fallbackResult = this.fallbackClassification(text, context);
        console.log('📊 [IntentService] Fallback result:', JSON.stringify(fallbackResult));
        return fallbackResult;
      }

      console.log('🚀 [IntentService] Using LLM for classification');
      const prompt = this.createIntentClassificationPrompt(text, context);
      console.log('📋 [IntentService] Generated prompt:');
      console.log('---PROMPT START---');
      console.log(prompt);
      console.log('---PROMPT END---');

      console.log('🤖 [IntentService] Sending request to LLM...');
      const response = await this.generateText(prompt, 300, provider);
      console.log('📨 [IntentService] Raw LLM response:');
      console.log('---RESPONSE START---');
      console.log(response);
      console.log('---RESPONSE END---');

      try {
        console.log('🔧 [IntentService] Parsing LLM response as JSON...');
        
        // Clean the response to handle markdown code blocks
        let cleanedResponse = response.trim();
        
        // Remove markdown code block markers if present
        if (cleanedResponse.startsWith('```json')) {
          console.log('🧹 [IntentService] Removing markdown json code block markers...');
          cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          console.log('🧹 [IntentService] Removing markdown code block markers...');
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('🧽 [IntentService] Cleaned response:');
        console.log('---CLEANED START---');
        console.log(cleanedResponse);
        console.log('---CLEANED END---');
        
        const intentResult = JSON.parse(cleanedResponse);
        console.log('✅ [IntentService] Successfully parsed JSON:', JSON.stringify(intentResult));
        
        const validatedResult = this.validateIntentResult(intentResult);
        console.log('🎯 [IntentService] Final validated result:', JSON.stringify(validatedResult));
        return validatedResult;
        
      } catch (parseError) {
        console.error('❌ [IntentService] Failed to parse LLM response as JSON:', parseError);
        console.log('📄 [IntentService] Raw response that failed to parse:', JSON.stringify(response));
        console.log('⚠️ [IntentService] Falling back to rule-based classification due to parse error');
        
        const fallbackResult = this.fallbackClassification(text, context);
        console.log('📊 [IntentService] Fallback result:', JSON.stringify(fallbackResult));
        return fallbackResult;
      }

    } catch (error) {
      console.error('❌ [IntentService] Intent classification error:', error);
      console.error('🔍 [IntentService] Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      console.log('⚠️ [IntentService] Falling back to rule-based classification due to error');
      
      const fallbackResult = this.fallbackClassification(text, context);
      console.log('📊 [IntentService] Fallback result:', JSON.stringify(fallbackResult));
      return fallbackResult;
    }
  }

  private async isProviderAvailable(provider: string): Promise<boolean> {
    console.log('🔍 [IntentService] Checking provider availability for:', provider);
    
    try {
      const isAvailable = await this.llmService.isProviderAvailable(provider as any);
      console.log('✅ [IntentService] Provider availability check result:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('❌ [IntentService] Provider availability check failed:', error);
      return false;
    }
  }

  private async generateText(prompt: string, maxTokens: number, provider: string): Promise<string> {
    console.log('🤖 [IntentService] Generating text with parameters:');
    console.log('   Provider:', provider);
    console.log('   Max tokens:', maxTokens);
    console.log('   Prompt length:', prompt.length, 'characters');
    
    try {
      const result = await this.llmService.generateText(prompt, maxTokens, provider as any);
      console.log('✅ [IntentService] Text generation successful');
      console.log('📏 [IntentService] Response length:', result.length, 'characters');
      return result;
    } catch (error) {
      console.error('❌ [IntentService] Text generation failed:', error);
      throw new Error(`Failed to generate text: ${error}`);
    }
  }

  private createIntentClassificationPrompt(text: string, context?: {
    currentUrl?: string;
    hasStoredActionPlan?: boolean;
    pageTitle?: string;
  }): string {
    console.log('📋 [IntentService] Creating intent classification prompt');
    console.log('🔧 [IntentService] Input parameters:');
    console.log('   Text:', JSON.stringify(text));
    console.log('   Context:', JSON.stringify(context));

    const contextInfo = context ? `
Current Context:
- URL: ${context.currentUrl || 'unknown'}
- Page Title: ${context.pageTitle || 'unknown'}
- Has Stored Action Plan: ${context.hasStoredActionPlan || false}
` : '';

    console.log('🌐 [IntentService] Context info section:', JSON.stringify(contextInfo));

    const prompt = `You are an intent classifier for a browser automation assistant. Analyze the user's input and classify it into one of these intents:

INTENT TYPES:
1. "action_execution" - User wants to execute a previously planned action (e.g., "do it", "execute", "run it", "go ahead", "proceed")
2. "navigation" - User wants to navigate to a URL or platform (e.g., "go to google.com", "navigate to amazon", "login to xiaohongshu")
3. "search" - User wants to search on a specific platform (e.g., "search google for cats", "find videos about cooking on bilibili", "xiaohongshu search fashion", "用小红书搜口袋黄", "小红书搜索时尚")
4. "xiaohongshu_summary" - User wants to summarize Xiaohongshu content (e.g., "summarize xiaohongshu posts about travel", "sum up xiaohongshu fashion posts", "总结小红书旅游帖子")
5. "xiaohongshu_extract" - User wants to extract Xiaohongshu posts (e.g., "extract xiaohongshu posts", "get posts from this page", "提取小红书帖子")
6. "action_planning" - User wants to plan actions on current page (e.g., "search for something", "find products", "look for videos")
7. "general_chat" - General conversation or questions that don't fit other categories

${contextInfo}

User Input: "${text}"

Return ONLY a JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "intent": "intent_name",
  "confidence": 0.95,
  "parameters": {
    "query": "extracted search term",
    "engine": "google|bilibili|xiaohongshu|general",
    "url": "extracted URL",
    "platform": "platform name"
  },
  "reasoning": "brief explanation"
}

RULES:
- confidence should be between 0.0 and 1.0
- parameters object should only include relevant fields for the intent
- for search intents, always include "query" and "engine" parameters
- for navigation intents, include "url" and/or "platform" parameters
- for action_execution, check if context.hasStoredActionPlan is true
- be case-insensitive but precise in classification
- understand both English and Chinese search patterns (e.g., "用小红书搜X" = search xiaohongshu for X)
- IMPORTANT: Return ONLY the JSON object, no markdown formatting, no \`\`\`json\`\`\` blocks`;

    console.log('✅ [IntentService] Prompt created successfully');
    return prompt;
  }

  private validateIntentResult(result: any): IntentResult {
    console.log('🔧 [IntentService] Validating intent result');
    console.log('📋 [IntentService] Raw result to validate:', JSON.stringify(result));

    const validIntents = [
      'action_execution', 'navigation', 'search', 'xiaohongshu_summary', 
      'xiaohongshu_extract', 'action_planning', 'general_chat'
    ];

    const originalIntent = result.intent;
    if (!result.intent || !validIntents.includes(result.intent)) {
      console.log('⚠️ [IntentService] Invalid intent detected:', result.intent);
      console.log('🔄 [IntentService] Changing to general_chat');
      result.intent = 'general_chat';
    } else {
      console.log('✅ [IntentService] Intent is valid:', result.intent);
    }

    const originalConfidence = result.confidence;
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      console.log('⚠️ [IntentService] Invalid confidence detected:', result.confidence);
      console.log('🔄 [IntentService] Setting confidence to 0.5');
      result.confidence = 0.5;
    } else {
      console.log('✅ [IntentService] Confidence is valid:', result.confidence);
    }

    if (!result.parameters) {
      console.log('⚠️ [IntentService] Missing parameters object, creating empty one');
      result.parameters = {};
    } else {
      console.log('✅ [IntentService] Parameters object exists:', JSON.stringify(result.parameters));
    }

    const validatedResult = {
      intent: result.intent,
      confidence: result.confidence,
      parameters: result.parameters,
      reasoning: result.reasoning || 'No reasoning provided'
    };

    console.log('📊 [IntentService] Validation summary:');
    console.log('   Original intent:', originalIntent, '→', validatedResult.intent);
    console.log('   Original confidence:', originalConfidence, '→', validatedResult.confidence);
    console.log('   Parameters count:', Object.keys(validatedResult.parameters).length);
    console.log('   Has reasoning:', !!validatedResult.reasoning);

    return validatedResult;
  }

  private fallbackClassification(text: string, context?: {
    currentUrl?: string;
    hasStoredActionPlan?: boolean;
    pageTitle?: string;
  }): IntentResult {
    console.log('🔄 [IntentService] Starting fallback rule-based classification');
    console.log('📝 [IntentService] Fallback input text:', JSON.stringify(text));
    console.log('🌐 [IntentService] Fallback context:', JSON.stringify(context));

    const lowerText = text.toLowerCase().trim();
    console.log('🔤 [IntentService] Lowercase text:', JSON.stringify(lowerText));

    // Action execution (highest priority if there's a stored plan)
    const executionPhrases = ['do it', 'execute', 'run it', 'go ahead', 'proceed'];
    console.log('🎯 [IntentService] Checking for action execution phrases...');
    
    if (context?.hasStoredActionPlan && executionPhrases.some(phrase => lowerText.includes(phrase))) {
      console.log('✅ [IntentService] Matched action execution with stored plan');
      const result = {
        intent: 'action_execution' as const,
        confidence: 0.9,
        parameters: {},
        reasoning: 'Matched execution phrase with stored action plan'
      };
      console.log('📊 [IntentService] Fallback result (action_execution):', JSON.stringify(result));
      return result;
    }
    console.log('⏭️ [IntentService] No action execution match');

    // Navigation patterns
    const navigationPatterns = [
      /^go to (.+)$/i,
      /^navigate to (.+)$/i,
      /^login to (.+)$/i,
      /^(.+) login$/i
    ];

    console.log('🧭 [IntentService] Checking navigation patterns...');
    for (const [index, pattern] of navigationPatterns.entries()) {
      console.log(`   Testing pattern ${index + 1}:`, pattern.toString());
      const match = lowerText.match(pattern);
      if (match) {
        console.log('✅ [IntentService] Matched navigation pattern:', pattern.toString());
        console.log('🔗 [IntentService] Extracted URL/platform:', match[1]);
        
        const result = {
          intent: 'navigation' as const,
          confidence: 0.85,
          parameters: {
            url: match[1],
            platform: match[1]
          },
          reasoning: 'Matched navigation pattern'
        };
        console.log('📊 [IntentService] Fallback result (navigation):', JSON.stringify(result));
        return result;
      }
    }
    console.log('⏭️ [IntentService] No navigation pattern match');

    // Search patterns
    console.log('🔍 [IntentService] Checking for search keywords...');
    const searchKeywords = ['search', 'find', 'look for', '搜', '搜索', '查找', '找'];
    const hasSearchKeyword = searchKeywords.some(keyword => {
      const found = lowerText.includes(keyword);
      console.log(`   Keyword "${keyword}":`, found);
      return found;
    });

    if (hasSearchKeyword) {
      console.log('✅ [IntentService] Found search keywords, analyzing...');
      
      let engine = 'general';
      let query = text;

      console.log('🔧 [IntentService] Detecting search engine...');
      if (lowerText.includes('google')) {
        engine = 'google';
        query = text.replace(/google|search|for|find|搜|搜索/gi, '').trim();
        console.log('   Detected Google search');
      } else if (lowerText.includes('bilibili')) {
        engine = 'bilibili';
        query = text.replace(/bilibili|search|for|find|搜|搜索/gi, '').trim();
        console.log('   Detected Bilibili search');
      } else if (lowerText.includes('xiaohongshu') || lowerText.includes('小红书')) {
        engine = 'xiaohongshu';
        query = text.replace(/xiaohongshu|小红书|search|for|find|搜|搜索|用|去/gi, '').trim();
        console.log('   Detected Xiaohongshu search');
      } else {
        console.log('   Using general search engine');
        // Clean up Chinese search terms for general search
        query = text.replace(/search|for|find|搜|搜索/gi, '').trim();
      }

      console.log('🔍 [IntentService] Final search parameters:');
      console.log('   Engine:', engine);
      console.log('   Query:', JSON.stringify(query));

      const result = {
        intent: 'search' as const,
        confidence: 0.8,
        parameters: {
          query,
          engine
        },
        reasoning: 'Matched search keywords'
      };
      console.log('📊 [IntentService] Fallback result (search):', JSON.stringify(result));
      return result;
    }
    console.log('⏭️ [IntentService] No search keywords found');

    // Xiaohongshu specific (also check for Chinese patterns)
    console.log('📱 [IntentService] Checking for Xiaohongshu-specific patterns...');
    if (lowerText.includes('xiaohongshu') || lowerText.includes('小红书')) {
      console.log('✅ [IntentService] Found Xiaohongshu mention, checking specific actions...');
      
      // Check for Chinese search patterns like "用小红书搜..." or "小红书搜索..."
      const chineseSearchPatterns = [
        /用小红书搜(.+)/i,
        /小红书搜索(.+)/i,
        /小红书搜(.+)/i,
        /在小红书搜(.+)/i,
        /去小红书搜(.+)/i
      ];
      
      for (const pattern of chineseSearchPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          console.log('✅ [IntentService] Matched Chinese Xiaohongshu search pattern');
          const extractedQuery = match[1].trim();
          console.log('🔍 [IntentService] Extracted query from Chinese pattern:', JSON.stringify(extractedQuery));
          
          const result = {
            intent: 'search' as const,
            confidence: 0.9,
            parameters: {
              query: extractedQuery,
              engine: 'xiaohongshu'
            },
            reasoning: 'Matched Chinese Xiaohongshu search pattern'
          };
          console.log('📊 [IntentService] Fallback result (Chinese xiaohongshu search):', JSON.stringify(result));
          return result;
        }
      }
      
      if (lowerText.includes('summarize') || lowerText.includes('summary') || lowerText.includes('总结') || lowerText.includes('汇总')) {
        console.log('📋 [IntentService] Detected Xiaohongshu summarization request');
        const queryText = text.replace(/xiaohongshu|小红书|summarize|summary|总结|汇总/gi, '').trim();
        console.log('🔍 [IntentService] Extracted query:', JSON.stringify(queryText));
        
        const result = {
          intent: 'xiaohongshu_summary' as const,
          confidence: 0.85,
          parameters: {
            query: queryText
          },
          reasoning: 'Xiaohongshu summarization request'
        };
        console.log('📊 [IntentService] Fallback result (xiaohongshu_summary):', JSON.stringify(result));
        return result;
      }
      
      if (lowerText.includes('extract') || lowerText.includes('提取')) {
        console.log('📤 [IntentService] Detected Xiaohongshu extraction request');
        const result = {
          intent: 'xiaohongshu_extract' as const,
          confidence: 0.85,
          parameters: {},
          reasoning: 'Xiaohongshu extraction request'
        };
        console.log('📊 [IntentService] Fallback result (xiaohongshu_extract):', JSON.stringify(result));
        return result;
      }
      
      console.log('⏭️ [IntentService] Xiaohongshu mentioned but no specific action detected');
    } else {
      console.log('⏭️ [IntentService] No Xiaohongshu mention found');
    }

    // Action planning
    console.log('⚡ [IntentService] Checking for action planning keywords...');
    const actionKeywords = ['search', 'find', 'look for', 'videos about'];
    const hasActionKeyword = actionKeywords.some(keyword => {
      const found = lowerText.includes(keyword);
      console.log(`   Action keyword "${keyword}":`, found);
      return found;
    });

    if (hasActionKeyword) {
      console.log('✅ [IntentService] Found action planning keywords');
      const result = {
        intent: 'action_planning' as const,
        confidence: 0.7,
        parameters: {
          action: text
        },
        reasoning: 'Matched action planning keywords'
      };
      console.log('📊 [IntentService] Fallback result (action_planning):', JSON.stringify(result));
      return result;
    }
    console.log('⏭️ [IntentService] No action planning keywords found');

    // Default to general chat
    console.log('💬 [IntentService] No specific patterns matched, defaulting to general_chat');
    const result = {
      intent: 'general_chat' as const,
      confidence: 0.5,
      parameters: {},
      reasoning: 'No specific intent pattern matched'
    };
    console.log('📊 [IntentService] Fallback result (general_chat):', JSON.stringify(result));
    return result;
  }
} 