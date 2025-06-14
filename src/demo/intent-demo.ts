/**
 * Demo script to showcase LLM-based intent classification
 * This demonstrates how the new IntentService can understand natural language
 * better than the previous rule-based approach.
 */

import { IntentService } from '../services/intent-service';
import { IntentConfig, INTENT_DEFINITIONS } from '../config/intent-config';

export class IntentDemo {
  private intentService = IntentService.getInstance();

  async demonstrateIntentClassification() {
    console.log('🚀 LLM-Based Intent Classification Demo\n');
    console.log('🎯 This demo will show detailed logs of the classification process');
    console.log('📊 Watch for the [IntentService] logs to see LLM interaction\n');
    
    console.log('📋 Available intents from centralized configuration:');
    Object.entries(INTENT_DEFINITIONS).forEach(([id, definition]) => {
      console.log(`   ${id}: ${definition.description}`);
    });
    console.log('');

    const testCases = this.generateTestCasesFromConfig();

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

        // Wait a bit between requests to avoid rate limiting
        if (index < testCases.length - 1) {
          console.log('⏳ Waiting 1 second before next test...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Test case ${index + 1} failed:`, error);
        console.error('Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 Demo completed!');
    console.log(`📊 Tested ${testCases.length} different intent scenarios`);
    console.log('💡 All examples were generated from centralized intent configuration');
    console.log(`${'='.repeat(80)}`);
  }

  private generateTestCasesFromConfig() {
    const testCases: Array<{
      text: string;
      context?: any;
      description: string;
    }> = [];

    // Generate test cases from each intent definition
    Object.entries(INTENT_DEFINITIONS).forEach(([intentId, definition]) => {
      // Add basic examples
      definition.examples.forEach((example, index) => {
        const contextForIntent = this.getContextForIntent(intentId);
        testCases.push({
          text: example,
          context: contextForIntent,
          description: `${definition.name} - Example ${index + 1}`
        });
      });

      // Add Chinese examples if available
      if (definition.chineseExamples) {
        definition.chineseExamples.forEach((example, index) => {
          const contextForIntent = this.getContextForIntent(intentId);
          testCases.push({
            text: example,
            context: contextForIntent,
            description: `${definition.name} - Chinese Example ${index + 1}`
          });
        });
      }
    });

    return testCases;
  }

  private getContextForIntent(intentId: string): any {
    const definition = IntentConfig.getIntentDefinition(intentId);
    if (!definition?.requiresContext) return undefined;

    const context: any = {};
    
    // Set up context based on requirements
    if (definition.requiresContext.includes('hasStoredActionPlan')) {
      context.hasStoredActionPlan = true;
    }

    return Object.keys(context).length > 0 ? context : undefined;
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
      
      // Show which intent definition this matches
      const definition = IntentConfig.getIntentDefinition(result.intent);
      if (definition) {
        console.log('\n📋 MATCHED INTENT DEFINITION:');
        console.log(`Name: ${definition.name}`);
        console.log(`Description: ${definition.description}`);
        console.log(`Examples: ${definition.examples.join(', ')}`);
        if (definition.chineseExamples) {
          console.log(`Chinese Examples: ${definition.chineseExamples.join(', ')}`);
        }
      }
      
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
};

// Export debug function for specific testing
export const debugQuery = async (text: string, context?: any) => {
  const demo = new IntentDemo();
  return await demo.debugSpecificQuery(text, context);
}; 