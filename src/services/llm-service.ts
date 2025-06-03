import { ChatResponse, LLMProvider } from '../types';
import { OpenAIService } from './openai-service';
import { BedrockService } from './bedrock-service';
import { ContextService } from './context-service';
import { ConfigService } from './config-service';

export class LLMService {
  private static instance: LLMService;
  private openaiService = new OpenAIService();
  private bedrockService = new BedrockService();
  private contextService = new ContextService();
  private configService = ConfigService.getInstance();

  private constructor() {}

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  async handleChat(
    payload: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChatResponse) => void
  ): Promise<void> {
    const { text, sessionId, tabId: payloadTabId, tabUrl, tabTitle } = payload;
    const tabId = sender.tab?.id || payloadTabId;

    // Handle help command
    if (text.toLowerCase().trim() === 'help') {
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: 'I can help you navigate this website. Try commands like "go to contact page", "find pricing", "extract info about this page", or "set context" to use the page content as context for our conversation.',
          sessionId
        }
      });
      return;
    }

    try {
      const llmSettings = await this.configService.getLLMSettings();
      const provider = llmSettings.provider;

      // Check if the selected provider is available
      const isAvailable = await this.isProviderAvailable(provider);
      if (!isAvailable) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'AWS Bedrock';
        const credentialsMessage = provider === 'openai' 
          ? 'Please set your OpenAI API key in the extension settings.'
          : 'Please configure your AWS Bedrock credentials in the extension settings.';
        
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `${providerName} is not configured. ${credentialsMessage}`,
            sessionId
          }
        });
        return;
      }

      // Get page context
      const pageInfo = tabId ? await this.contextService.getPageInfo(tabId) : null;
      const fallbackPageInfo = this.createFallbackPageInfo(sender, tabUrl, tabTitle);
      const finalPageInfo = pageInfo || fallbackPageInfo;

      // Debug logging for page context
      console.log('🔍 [DEBUG] Page context retrieval:');
      console.log('  - tabId:', tabId);
      console.log('  - pageInfo from contextService:', pageInfo);
      console.log('  - fallbackPageInfo:', fallbackPageInfo);
      console.log('  - finalPageInfo:', finalPageInfo);
      console.log('  - finalPageInfo.content exists:', !!finalPageInfo?.content);
      console.log('  - finalPageInfo.content length:', finalPageInfo?.content?.length || 0);

      // Check if this is a summarize request
      const isSummarizeRequest = this.isSummarizeRequest(text);

      // Generate response using the configured provider
      const response = await this.generateAIResponse(
        text,
        finalPageInfo,
        tabId,
        isSummarizeRequest,
        sessionId,
        provider
      );

      sendResponse(response);

    } catch (error) {
      console.error('Error in LLM chat handling:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `I encountered an error while processing your request. ${(error as Error).message || 'Please try again.'}`,
          sessionId
        }
      });
    }
  }

  async analyzeSearchElements(
    payload: { html: string; url: string; title: string },
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      const llmSettings = await this.configService.getLLMSettings();
      const provider = llmSettings.provider;

      const isAvailable = await this.isProviderAvailable(provider);
      if (!isAvailable) {
        sendResponse({ error: `${provider} not available` });
        return;
      }

      const prompt = this.createSearchAnalysisPrompt(payload);
      const response = await this.generateText(prompt, 300, provider);

      try {
        const searchElements = JSON.parse(response);
        if (Array.isArray(searchElements)) {
          sendResponse({ searchElements });
        } else {
          throw new Error('Invalid response format');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', response);
        sendResponse({ error: 'Invalid AI response format' });
      }

    } catch (error) {
      console.error('Search element analysis failed:', error);
      sendResponse({ error: (error as Error).message });
    }
  }

  async summarizeXiaohongshuPosts(
    payload: { content: any; sessionId: string },
    sendResponse: (response: ChatResponse) => void
  ): Promise<void> {
    try {
      const llmSettings = await this.configService.getLLMSettings();
      const provider = llmSettings.provider;

      const isAvailable = await this.isProviderAvailable(provider);
      if (!isAvailable) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'AWS Bedrock';
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: `${providerName} is not configured. Please check your settings to enable post summarization.`,
            sessionId: payload.sessionId
          }
        });
        return;
      }

      const { content } = payload;
      
      if (!content.posts || content.posts.length === 0) {
        sendResponse({
          type: 'MESSAGE',
          payload: {
            text: 'No posts found to summarize. Please try searching again.',
            sessionId: payload.sessionId
          }
        });
        return;
      }

      const prompt = this.createXiaohongshuSummaryPrompt(content);
      const summary = await this.generateText(prompt, 2000, provider);

      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: summary || 'Unable to generate summary',
          sessionId: payload.sessionId
        }
      });

    } catch (error) {
      console.error('Xiaohongshu post summarization failed:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `Failed to summarize posts: ${(error as Error).message}. Please try again.`,
          sessionId: payload.sessionId
        }
      });
    }
  }

  async isProviderAvailable(provider: LLMProvider): Promise<boolean> {
    switch (provider) {
      case 'openai':
        return await this.openaiService.initialize();
      case 'bedrock':
        return await this.bedrockService.isInitialized();
      default:
        return false;
    }
  }

  async generateText(prompt: string, maxTokens: number, provider: LLMProvider): Promise<string> {
    switch (provider) {
      case 'openai':
        const openaiResponse = await this.openaiService.generateText(prompt, maxTokens);
        return openaiResponse.content;
      case 'bedrock':
        const bedrockResponse = await this.bedrockService.generateText(prompt, maxTokens);
        return bedrockResponse.content;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async generateAIResponse(
    text: string,
    pageInfo: any,
    tabId: number | undefined,
    isSummarizeRequest: boolean,
    sessionId: string,
    provider: LLMProvider
  ): Promise<ChatResponse> {
    const systemPrompt = this.createSystemPrompt(pageInfo, tabId, isSummarizeRequest);
    const fullPrompt = `${systemPrompt}\n\nUser: ${text}\n\nAssistant:`;
    
    // Log the final prompt being sent to LLM
    console.log('🤖 [LLM REQUEST] Final prompt being sent to AI:');
    console.log('==========================================');
    console.log(fullPrompt);
    console.log('==========================================');
    
    const responseText = await this.generateText(fullPrompt, 1000, provider);

    return {
      type: 'MESSAGE',
      payload: {
        text: responseText,
        sessionId
      }
    };
  }

  private createSystemPrompt(pageInfo: any, tabId: number | undefined, isSummarizeRequest: boolean): string {
    // Debug logging for pageInfo
    console.log('🔍 [DEBUG] createSystemPrompt called with:');
    console.log('  - tabId:', tabId);
    console.log('  - isSummarizeRequest:', isSummarizeRequest);
    console.log('  - pageInfo:', pageInfo);
    console.log('  - pageInfo.content exists:', !!pageInfo?.content);
    console.log('  - pageInfo.content length:', pageInfo?.content?.length || 0);
    if (pageInfo?.content) {
      console.log('  - pageInfo.content preview:', pageInfo.content.substring(0, 200) + '...');
    }

    const basePrompt = isSummarizeRequest 
      ? "You are a helpful assistant that summarizes web page content clearly and concisely."
      : "You are a helpful assistant that can help users navigate websites and answer questions about web pages.";

    if (pageInfo && pageInfo.content) {
      console.log('✅ [DEBUG] Using pageInfo.content in system prompt');
      return `${basePrompt} You have access to the current page content:
      
URL: ${pageInfo.url}
Title: ${pageInfo.title}
Content: ${pageInfo.content}

Use this context to provide helpful and accurate responses.`;
    }

    console.log('⚠️ [DEBUG] No pageInfo.content available, using fallback prompt');
    return `${basePrompt} You can help users navigate websites and provide information about the current page at ${pageInfo?.url || 'this website'}.`;
  }

  private createFallbackPageInfo(sender: chrome.runtime.MessageSender, tabUrl?: string, tabTitle?: string): any {
    return {
      url: tabUrl || sender.tab?.url || 'unknown',
      title: tabTitle || sender.tab?.title || 'Unknown Page',
      content: null
    };
  }

  private isSummarizeRequest(text: string): boolean {
    const summarizeKeywords = ['summarize', 'summary', 'sum up', 'brief', 'overview'];
    return summarizeKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  private createSearchAnalysisPrompt(payload: { html: string; url: string; title: string }): string {
    return `Analyze the following HTML from ${payload.url} and identify search-related elements.
    Return a JSON array of objects with properties: type, selector, placeholder (if applicable).
    
    HTML snippet:
    ${payload.html.substring(0, 2000)}
    
    Look for search boxes, search buttons, filters, and other search-related UI elements.
    Return only valid JSON, no additional text.`;
  }

  private createXiaohongshuSummaryPrompt(content: any): string {
    let prompt = "Please summarize the following Xiaohongshu posts in a clear and organized way:\n\n";
    
    content.posts.forEach((post: any, index: number) => {
      prompt += `Post ${index + 1}:\n`;
      prompt += `Title: ${post.title || 'No title'}\n`;
      prompt += `Content: ${post.content || 'No content'}\n`;
      prompt += `Author: ${post.author || 'Unknown'}\n`;
      if (post.likes) prompt += `Likes: ${post.likes}\n`;
      if (post.comments) prompt += `Comments: ${post.comments}\n`;
      prompt += "\n";
    });

    prompt += "Please provide a comprehensive summary highlighting the main themes, popular topics, and key insights from these posts.";
    
    return prompt;
  }
} 