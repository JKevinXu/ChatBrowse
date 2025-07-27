export interface IntentDefinition {
  id: string;
  name: string;
  description: string;
  examples: string[];
  chineseExamples?: string[];
  parameters?: string[];
  requiresContext?: string[];
}

export const INTENT_DEFINITIONS: Record<string, IntentDefinition> = {
  action_execution: {
    id: 'action_execution',
    name: 'Action Execution',
    description: 'User wants to execute a previously planned action',
    examples: ['do it', 'execute', 'run it', 'go ahead', 'proceed'],
    requiresContext: ['hasStoredActionPlan']
  },
  
  navigation: {
    id: 'navigation',
    name: 'Navigation',
    description: 'User wants to navigate to a URL or platform',
    examples: ['go to google.com', 'navigate to amazon', 'login to xiaohongshu'],
    parameters: ['url', 'platform']
  },
  
  search: {
    id: 'search',
    name: 'Search',
    description: 'User wants to search on a specific platform',
    examples: [
      'search google for cats', 
      'find videos about cooking on bilibili', 
      'xiaohongshu search fashion'
    ],
    chineseExamples: ['用小红书搜口袋黄', '小红书搜索时尚'],
    parameters: ['query', 'engine']
  },
  
  xiaohongshu_summary: {
    id: 'xiaohongshu_summary',
    name: 'Xiaohongshu Summary',
    description: 'User wants to summarize Xiaohongshu content',
    examples: [
      'summarize xiaohongshu posts about travel', 
      'sum up xiaohongshu fashion posts',
      'xiaohongshu: travel tips',
      'xiaohongshu: fashion trends'
    ],
    chineseExamples: ['总结小红书旅游帖子', 'xiaohongshu: 澳大利亚旅游', 'xiaohongshu: 时尚穿搭'],
    parameters: ['query']
  },
  
  xiaohongshu_extract: {
    id: 'xiaohongshu_extract',
    name: 'Xiaohongshu Extract',
    description: 'User wants to extract Xiaohongshu posts',
    examples: [
      'extract xiaohongshu posts', 
      'get posts from this page',
      'extract xiaohongshu posts: fashion',
      'xiaohongshu extract posts'
    ],
    chineseExamples: ['提取小红书帖子', 'extract xiaohongshu posts: 旅游攻略']
  },
  
  action_planning: {
    id: 'action_planning',
    name: 'Action Planning',
    description: 'User wants to plan SPECIFIC UI actions on current page',
    examples: [
      'click bulk actions', 
      'download data', 
      'select items', 
      'click the submit button', 
      'fill out the form'
    ]
  },
  
  general_chat: {
    id: 'general_chat',
    name: 'General Chat',
    description: 'General conversation, questions, or content requests that don\'t fit other categories',
    examples: [
      'what\'s the weather?', 
      'tell me a joke', 
      'summarize the page', 
      'explain this content', 
      'what does this mean?'
    ]
  }
};

// Derived types and utilities
export type IntentType = keyof typeof INTENT_DEFINITIONS;

export const VALID_INTENTS = Object.keys(INTENT_DEFINITIONS) as IntentType[];

export const DEFAULT_INTENT: IntentType = 'general_chat';

// Intent configuration utilities
export class IntentConfig {
  static getIntentDefinition(intentId: string): IntentDefinition | undefined {
    return INTENT_DEFINITIONS[intentId];
  }
  
  static isValidIntent(intent: string): intent is IntentType {
    return intent in INTENT_DEFINITIONS;
  }
  
  static getAllIntents(): IntentType[] {
    return VALID_INTENTS;
  }
  
  static getIntentExamples(intentId: string): string[] {
    const definition = this.getIntentDefinition(intentId);
    if (!definition) return [];
    
    return [
      ...definition.examples,
      ...(definition.chineseExamples || [])
    ];
  }
  
  static generateLLMPromptSection(): string {
    let promptSection = 'INTENT TYPES:\n';
    
    Object.entries(INTENT_DEFINITIONS).forEach(([id, definition], index) => {
      const allExamples = [
        ...definition.examples,
        ...(definition.chineseExamples || [])
      ];
      
      promptSection += `${index + 1}. "${id}" - ${definition.description} (e.g., ${allExamples.map(ex => `"${ex}"`).join(', ')})\n`;
    });
    
    return promptSection;
  }
  
  static generateIntentDistinctions(): string {
    return `IMPORTANT DISTINCTIONS:
- "action_planning" is ONLY for specific UI interactions (clicking, selecting, downloading, form filling)
- "general_chat" includes content analysis, page summarization, explanations, and general questions
- "xiaohongshu_summary" is specifically for analyzing Xiaohongshu platform content
- General page summarization requests like "summarize the page" should be "general_chat"`;
  }
} 