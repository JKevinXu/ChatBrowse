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

      } catch (error) {
        console.error(`❌ Error processing "${testCase.text}":`, error);
        console.error('🔍 Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack?.split('\n').slice(0, 5)
        });
      }
    }

    console.log('\n🎉 Demo completed! The LLM-based intent classifier provides:');
    console.log('• More flexible natural language understanding');
    console.log('• Better handling of variations and edge cases');
    console.log('• Confidence scores for each classification');
    console.log('• Detailed parameter extraction');
    console.log('• Reasoning explanations for decisions');
    console.log('• Graceful fallback to rule-based classification when LLM is unavailable');
  }

  async compareWithLegacy() {
    console.log('\n🔄 Comparison: LLM vs Rule-based Classification\n');
    console.log('📊 Testing challenging cases that show the difference...\n');

    const challengingCases = [
      {
        text: 'Could you please help me search for some cat videos on youtube?',
        description: 'Polite, complex search request'
      },
      {
        text: 'I would really appreciate it if you could navigate to the google homepage',
        description: 'Very polite navigation request'
      },
      {
        text: 'Can you find me some information about machine learning?',
        description: 'Vague search request'
      },
      {
        text: 'Please go ahead with the planned action',
        description: 'Verbose execution command'
      },
      {
        text: 'Show me posts about travel from xiaohongshu',
        description: 'Natural language Xiaohongshu request'
      }
    ];

    for (const [index, testCase] of challengingCases.entries()) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🆚 COMPARISON ${index + 1}/${challengingCases.length}: ${testCase.description}`);
      console.log(`📝 Input: "${testCase.text}"`);
      console.log(`${'='.repeat(60)}`);
      
      try {
        console.log('🤖 Testing LLM classification...');
        const startTime = Date.now();
        const llmResult = await this.intentService.classifyIntent(testCase.text);
        const llmDuration = Date.now() - startTime;
        
        console.log(`🤖 LLM Result: ${llmResult.intent} (${(llmResult.confidence * 100).toFixed(1)}%, ${llmDuration}ms)`);
        console.log(`   Parameters: ${JSON.stringify(llmResult.parameters)}`);
        console.log(`   Reasoning: ${llmResult.reasoning}`);
        
        // Simulate legacy rule-based result
        console.log('\n📏 Testing rule-based classification...');
        const legacyResult = this.simulateLegacyClassification(testCase.text);
        console.log(`📏 Rule-based Result: ${legacyResult}`);
        
        // Analysis
        console.log('\n📊 ANALYSIS:');
        if (llmResult.intent !== 'general_chat' && legacyResult.includes('general_chat')) {
          console.log('✅ LLM successfully classified where rule-based failed');
        } else if (llmResult.intent === legacyResult.split(' ')[0]) {
          console.log('🤝 Both systems agree on classification');
        } else {
          console.log('🤔 Systems disagree - review needed');
        }
        
        if (llmDuration < 100) {
          console.log('⚡ LLM response was fast - likely using fallback');
        }
        
      } catch (error) {
        console.error('❌ Error:', error);
      }
    }

    console.log('\n🎯 SUMMARY:');
    console.log('LLM-based classification handles natural language variations much better');
    console.log('Rule-based classification is faster but limited to exact patterns');
    console.log('The hybrid approach provides the best of both worlds!');
  }

  private simulateLegacyClassification(text: string): string {
    const lowerText = text.toLowerCase().trim();
    
    if (['do it', 'execute', 'run it', 'go ahead', 'proceed'].some(phrase => lowerText.includes(phrase))) {
      return 'action_execution (if stored plan exists)';
    }
    
    if (/^go to (.+)$/i.test(lowerText) || /^navigate to (.+)$/i.test(lowerText)) {
      return 'navigation';
    }
    
    if (lowerText.includes('search') || lowerText.includes('find') || lowerText.includes('look for')) {
      if (lowerText.includes('google')) return 'search (google)';
      if (lowerText.includes('bilibili')) return 'search (bilibili)';
      if (lowerText.includes('xiaohongshu')) return 'search (xiaohongshu)';
      return 'search or action_planning';
    }
    
    if (lowerText.includes('xiaohongshu') && lowerText.includes('extract')) {
      return 'xiaohongshu_extract';
    }
    
    if (lowerText.includes('xiaohongshu') && (lowerText.includes('summarize') || lowerText.includes('summary'))) {
      return 'xiaohongshu_summary';
    }
    
    return 'general_chat (fallback)';
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
  await demo.compareWithLegacy();
};

// Export debug function for specific testing
export const debugQuery = async (text: string, context?: any) => {
  const demo = new IntentDemo();
  return await demo.debugSpecificQuery(text, context);
}; 