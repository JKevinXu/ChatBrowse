/**
 * Demo script to showcase LLM-based intent classification
 * This demonstrates how the new IntentService can understand natural language
 * better than the previous rule-based approach.
 */

import { IntentService } from '../services/intent-service';

export class IntentDemo {
  private intentService = IntentService.getInstance();

  async demonstrateIntentClassification() {
    console.log('🚀 LLM-Based Intent Classification Demo\n');
    console.log('🎯 This demo will show detailed logs of the classification process');
    console.log('📊 Watch for the [IntentService] logs to see LLM interaction\n');

    const testCases = [
      // Action execution intents
      { text: 'do it', context: { hasStoredActionPlan: true }, description: 'Action execution with stored plan' },
      { text: 'please execute the plan', context: { hasStoredActionPlan: true }, description: 'Polite action execution' },
      { text: 'run it now', context: { hasStoredActionPlan: false }, description: 'Action execution without stored plan' },

      // Navigation intents
      { text: 'go to google.com', description: 'Simple navigation' },
      { text: 'navigate to amazon', description: 'Navigation without .com' },
      { text: 'take me to youtube', description: 'Natural language navigation' },
      { text: 'login to xiaohongshu', description: 'Platform-specific navigation' },

      // Search intents
      { text: 'search google for cats', description: 'Basic search command' },
      { text: 'find videos about cooking on bilibili', description: 'Complex search with platform' },
      { text: 'look for fashion posts on xiaohongshu', description: 'Natural language search' },
      { text: 'I want to search for machine learning tutorials', description: 'Conversational search request' },

      // Xiaohongshu specific
      { text: 'summarize xiaohongshu posts about travel', description: 'Xiaohongshu summarization' },
      { text: 'extract posts from this xiaohongshu page', description: 'Xiaohongshu extraction' },
      { text: 'get me a summary of fashion content on xiaohongshu', description: 'Natural language Xiaohongshu request' },

      // Action planning
      { text: 'help me find products on this page', description: 'Action planning request' },
      { text: 'search for something here', description: 'Vague action planning' },
      { text: 'videos about AI', description: 'Implicit search request' },

      // General chat
      { text: 'what is the weather today?', description: 'General question' },
      { text: 'tell me a joke', description: 'Entertainment request' },
      { text: 'how does machine learning work?', description: 'Educational question' },

      // Chinese Xiaohongshu patterns
      { text: '用小红书搜口袋黄', description: 'Chinese Xiaohongshu search pattern' },
      { text: '小红书搜索时尚', description: 'Chinese Xiaohongshu search alternative' },
      { text: '去小红书搜美食', description: 'Chinese Xiaohongshu food search' },
      { text: '总结小红书旅游帖子', description: 'Chinese Xiaohongshu summarization' },
      { text: '提取小红书帖子', description: 'Chinese Xiaohongshu extraction' },

      // Edge cases - natural language variations
      { text: 'could you please search for cats on google?', description: 'Polite search request' },
      { text: 'I would like to navigate to the amazon website', description: 'Formal navigation request' },
      { text: 'can you help me find some information about travel?', description: 'Help-seeking language' },
      { text: 'please go ahead and execute the action', description: 'Verbose execution command' }
    ];

    for (const [index, testCase] of testCases.entries()) {
      try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🧪 TEST CASE ${index + 1}/${testCases.length}: ${testCase.description}`);
        console.log(`📝 Input: "${testCase.text}"`);
        if (testCase.context) {
          console.log(`🌐 Context: ${JSON.stringify(testCase.context)}`);
        }
        console.log(`${'='.repeat(80)}`);

        console.log('⏱️ Starting classification...');
        const startTime = Date.now();
        
        const result = await this.intentService.classifyIntent(testCase.text, testCase.context);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('\n📊 CLASSIFICATION RESULT:');
        console.log(`✅ Intent: ${result.intent}`);
        console.log(`📈 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`⏱️ Duration: ${duration}ms`);
        
        if (result.parameters && Object.keys(result.parameters).length > 0) {
          console.log(`🔧 Parameters: ${JSON.stringify(result.parameters, null, 2)}`);
        }
        
        if (result.reasoning) {
          console.log(`💭 Reasoning: ${result.reasoning}`);
        }

        // Provide analysis
        if (result.confidence >= 0.9) {
          console.log('🎯 ANALYSIS: Very high confidence classification');
        } else if (result.confidence >= 0.7) {
          console.log('✅ ANALYSIS: Good confidence classification');
        } else if (result.confidence >= 0.5) {
          console.log('⚠️ ANALYSIS: Moderate confidence - might be ambiguous');
        } else {
          console.log('❌ ANALYSIS: Low confidence - likely fallback classification');
        }

        if (duration > 1000) {
          console.log('⏰ PERFORMANCE: Slow response (>1s) - check LLM latency');
        } else if (duration < 100) {
          console.log('⚡ PERFORMANCE: Fast response (<100ms) - likely rule-based fallback');
        } else {
          console.log('🚀 PERFORMANCE: Normal LLM response time');
        }

        // Wait a bit between requests to avoid rate limiting
        if (index < testCases.length - 1) {
          console.log('⏳ Waiting 1 second before next test...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ TEST CASE ${index + 1} FAILED:`, error);
        console.error('Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack?.split('\n').slice(0, 3).join('\n')
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 DEMO COMPLETED!');
    console.log('📊 Check the logs above to see how each intent was classified');
    console.log('🔍 Pay attention to confidence scores and reasoning');
    console.log(`${'='.repeat(80)}\n`);
  }

  async runComparison() {
    console.log('⚖️ LLM vs Legacy Classification Comparison');
    console.log('This feature has been removed as fallback classification is no longer available.\n');
  }

  async debugSpecificQuery(text: string, context?: any) {
    console.log('\n🔍 DEBUGGING SPECIFIC QUERY');
    console.log(`📝 Query: "${text}"`);
    if (context) {
      console.log(`🌐 Context: ${JSON.stringify(context, null, 2)}`);
    }
    console.log('=' + '='.repeat(50));

    try {
      console.log('🎯 Starting detailed classification...');
      const result = await this.intentService.classifyIntent(text, context);
      
      console.log('\n✅ FINAL RESULT:');
      console.log(`Intent: ${result.intent}`);
      console.log(`Confidence: ${result.confidence}`);
      console.log(`Parameters: ${JSON.stringify(result.parameters, null, 2)}`);
      console.log(`Reasoning: ${result.reasoning}`);
      
      return result;
    } catch (error) {
      console.error('❌ Classification failed:', error);
      throw error;
    }
  }
}

// Export for testing
export const runIntentDemo = async () => {
  const demo = new IntentDemo();
  await demo.demonstrateIntentClassification();
  await demo.runComparison();
};

// Export debug function for specific testing
export const debugQuery = async (text: string, context?: any) => {
  const demo = new IntentDemo();
  return await demo.debugSpecificQuery(text, context);
}; 