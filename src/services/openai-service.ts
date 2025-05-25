import OpenAI from 'openai';
import { ChatResponse, StorageData } from '../types';
import { loadFromStorage } from '../utils';
import { ContextService } from './context-service';

export class OpenAIService {
  private openai: OpenAI | null = null;
  private contextService = new ContextService();

  async initialize(): Promise<boolean> {
    try {
      const settings = await loadFromStorage<StorageData['settings']>('settings');
      if (settings && settings.openaiApiKey) {
        this.openai = new OpenAI({
          apiKey: settings.openaiApiKey,
          dangerouslyAllowBrowser: true
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('OpenAI initialization failed:', error);
      return false;
    }
  }

  async handleChat(
    payload: any,
    sender: chrome.MessageSender,
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
      // Ensure OpenAI is initialized
      if (!this.openai) {
        const initialized = await this.initialize();
        if (!initialized) {
          sendResponse({
            type: 'MESSAGE',
            payload: {
              text: 'Please set your OpenAI API key in the extension settings to enable AI responses.',
              sessionId
            }
          });
          return;
        }
      }

      // Get page context
      const pageInfo = tabId ? await this.contextService.getPageInfo(tabId) : null;
      const fallbackPageInfo = this.createFallbackPageInfo(sender, tabUrl, tabTitle);
      const finalPageInfo = pageInfo || fallbackPageInfo;

      // Check if this is a summarize request
      const isSummarizeRequest = this.isSummarizeRequest(text);

      // Generate response
      const response = await this.generateAIResponse(
        text,
        finalPageInfo,
        tabId,
        isSummarizeRequest,
        sessionId
      );

      sendResponse(response);

    } catch (error) {
      console.error('Error in OpenAI chat handling:', error);
      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: `I encountered an error while processing your request. ${(error as Error).message || 'Please try again or check your API key.'}`,
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
      if (!this.openai) {
        await this.initialize();
      }

      if (!this.openai) {
        sendResponse({ error: 'OpenAI not available' });
        return;
      }

      const prompt = this.createSearchAnalysisPrompt(payload);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
      });

      const response = completion.choices[0]?.message?.content?.trim() || '';

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
      if (!this.openai) {
        const initialized = await this.initialize();
        if (!initialized) {
          sendResponse({
            type: 'MESSAGE',
            payload: {
              text: 'Please set your OpenAI API key in the extension settings to enable post summarization.',
              sessionId: payload.sessionId
            }
          });
          return;
        }
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

      if (!this.openai) {
        throw new Error('OpenAI client not available');
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt } as const],
        max_tokens: 2000
      });

      const summary = completion.choices[0]?.message?.content?.trim() || 'Unable to generate summary';

      sendResponse({
        type: 'MESSAGE',
        payload: {
          text: summary,
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

  private async generateAIResponse(
    text: string,
    pageInfo: any,
    tabId: number | undefined,
    isSummarizeRequest: boolean,
    sessionId: string
  ): Promise<ChatResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not available');
    }

    const systemPrompt = this.createSystemPrompt(pageInfo, tabId, isSummarizeRequest);
    
    const messages: Array<{role: 'system' | 'user', content: string}> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: messages,
      max_tokens: 1500
    });

    let aiResponse = completion.choices[0]?.message?.content || 'No response generated';

    // For summarization requests, ensure the response includes the page title and URL
    if (isSummarizeRequest && !aiResponse.includes(pageInfo.url) && !aiResponse.includes("don't have")) {
      aiResponse = `Summary of: ${pageInfo.title}\nURL: ${pageInfo.url}\n\n${aiResponse}`;
    }

    return {
      type: 'MESSAGE',
      payload: {
        text: aiResponse,
        sessionId
      }
    };
  }

  private createSystemPrompt(pageInfo: any, tabId: number | undefined, isSummarizeRequest: boolean): string {
    const pageTitle = pageInfo.title || 'Current Website';
    const pageUrl = pageInfo.url || 'the current page';

    let systemPrompt = `You are ChatBrowse, an AI assistant that helps users browse the web. You are currently on a webpage with title: "${pageTitle}" and URL: "${pageUrl}". Keep responses concise and helpful for web browsing.`;

    // Include page content if context is enabled OR this is a summarize request
    const useContext = tabId && (this.contextService.hasContext(tabId) || isSummarizeRequest);

    if (isSummarizeRequest) {
      systemPrompt = `You are ChatBrowse, an AI assistant that helps users browse the web. The user is asking for a summary of a webpage with title: "${pageTitle}" and URL: "${pageUrl}". Always include the title and URL in your response.`;
      
      if (pageInfo && pageInfo.content && pageInfo.content.length > 0) {
        systemPrompt += `\n\nThe webpage content is: "${pageInfo.content}"\n\nPlease provide a concise summary of this webpage based on its content. Start your response with the title and URL of the page.`;
      } else {
        systemPrompt += `\n\nI don't have access to the content of this page. Please provide a response based on what you can tell from the title and URL. Start your response with the title and URL of the page, then explain that there is no content to summarize.`;
      }
    } else if (useContext && pageInfo && pageInfo.content) {
      systemPrompt += `\n\nThe current page content is: "${pageInfo.content}"`;
    }

    return systemPrompt;
  }

  private createFallbackPageInfo(sender: chrome.runtime.MessageSender, tabUrl?: string, tabTitle?: string): any {
    return {
      title: tabTitle || 'Current Website',
      url: tabUrl || sender.tab?.url || 'the current page',
      content: ''
    };
  }

  private isSummarizeRequest(text: string): boolean {
    const lowerText = text.toLowerCase();
    return lowerText.includes('summarize') && 
           (lowerText.includes('page') || lowerText.includes('website') || lowerText.includes('content'));
  }

  private createSearchAnalysisPrompt(payload: { html: string; url: string; title: string }): string {
    return `You are a web automation expert. Analyze this webpage structure and identify the best search input elements.

Website: ${payload.title}
URL: ${payload.url}

HTML Structure:
${payload.html}

Based on the HTML structure above, identify the most likely search input elements. Return a JSON array of search elements in this exact format:

[
  {
    "selector": "CSS_SELECTOR_HERE",
    "confidence": 0.95,
    "reason": "main search box with placeholder 'Search'"
  }
]

Rules:
1. Return ONLY valid CSS selectors that would work with document.querySelector()
2. Confidence should be 0.0-1.0 (higher = more confident)
3. Look for inputs with search-related attributes (name, id, placeholder, class)
4. Consider parent container context (forms, headers, nav bars)
5. Prioritize the most prominent/main search functionality
6. Return maximum 3 best candidates, sorted by confidence
7. Return ONLY the JSON array, no other text

CSS Selector Examples:
- input[name="search_query"]
- #search-input
- .search-box input
- input[placeholder*="Search"]`;
  }

  private createXiaohongshuSummaryPrompt(content: any): string {
    const postsData = content.posts.map((post: any, index: number) => {
      return `
帖子 ${index + 1}:
标题: ${post.title}
内容: ${post.content}
${post.link ? `链接: ${post.link}` : ''}
---`;
    }).join('\n');

    return `你是一个帮助总结小红书帖子的AI助手。

搜索查询: "${content.query}"
搜索结果: 总共找到 ${content.totalPostsFound} 条帖子，提取了 ${content.extractedCount} 条帖子
搜索链接: ${content.url}

需要总结的帖子:
${postsData}

请用中文提供全面的总结，包括：

1. **搜索概览**: 简要描述搜索内容和找到的结果
2. **主要话题**: 帖子中的主要话题和主题
3. **热门内容**: 帖子中最有趣或最有价值的见解
4. **要点总结**: 3-5个要点，突出最重要的信息
5. **内容质量**: 对找到内容的有用性和相关性的评估

请用清晰、有条理的中文回答，使用合适的标题格式，为对"${content.query}"话题感兴趣的小红书用户提供有用信息。

重点提供可操作的见解和有价值的信息。`;
  }
} 