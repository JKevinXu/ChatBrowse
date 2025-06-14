import { LLMService } from './llm-service';
import { ConfigService } from './config-service';
import { IntentType, IntentConfig, DEFAULT_INTENT, VALID_INTENTS } from '../config/intent-config';

export interface IntentResult {
  intent: IntentType;
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

    const llmSettings = await this.configService.getLLMSettings();
    const provider = llmSettings.provider;
    
    console.log('⚙️ [IntentService] LLM provider:', provider);

    // Check if LLM is available
    console.log('🔍 [IntentService] Checking if LLM provider is available...');
    const isAvailable = await this.isProviderAvailable(provider);
    console.log('✅ [IntentService] LLM provider available:', isAvailable);
    
    if (!isAvailable) {
      console.error('❌ [IntentService] LLM not available - no fallback classification');
      throw new Error('LLM provider is not available and fallback classification has been removed');
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

    // Use centralized configuration to generate prompt sections
    const intentTypesSection = IntentConfig.generateLLMPromptSection();
    const distinctionsSection = IntentConfig.generateIntentDistinctions();

    const prompt = `You are an intent classifier for a browser automation assistant. Analyze the user's input and classify it into one of these intents:

${intentTypesSection}

${distinctionsSection}

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

    const originalIntent = result.intent;
    if (!result.intent || !IntentConfig.isValidIntent(result.intent)) {
      console.log('⚠️ [IntentService] Invalid intent detected:', result.intent);
      console.log('🔄 [IntentService] Changing to default intent:', DEFAULT_INTENT);
      result.intent = DEFAULT_INTENT;
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

    const validatedResult: IntentResult = {
      intent: result.intent as IntentType,
      confidence: result.confidence,
      parameters: result.parameters,
      reasoning: result.reasoning || 'No reasoning provided'
    };

    console.log('📊 [IntentService] Validation summary:');
    console.log('   Original intent:', originalIntent, '→', validatedResult.intent);
    console.log('   Original confidence:', originalConfidence, '→', validatedResult.confidence);
    console.log('   Parameters count:', Object.keys(validatedResult.parameters || {}).length);
    console.log('   Has reasoning:', !!validatedResult.reasoning);

    return validatedResult;
  }
} 