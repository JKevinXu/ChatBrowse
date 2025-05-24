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
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: messages,
      max_tokens: 1500
    });

    let aiResponse = completion.choices[0].message.content || 'No response generated';

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

  private createFallbackPageInfo(sender: chrome.MessageSender, tabUrl?: string, tabTitle?: string): any {
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
Post ${index + 1}:
Title: ${post.title}
Content: ${post.content}
${post.link ? `Link: ${post.link}` : ''}
---`;
    }).join('\n');

    return `You are an AI assistant helping to summarize Xiaohongshu (Little Red Book) posts. 

Search Query: "${content.query}"
Search Results: Found ${content.totalPostsFound} posts total, extracted ${content.extractedCount} posts
Search URL: ${content.url}

Posts to Summarize:
${postsData}

Please provide a comprehensive summary that includes:

1. **Search Overview**: Brief description of what was searched and found
2. **Key Themes**: Main topics and themes across the posts
3. **Popular Content**: Most interesting or valuable insights from the posts
4. **Summary Points**: 3-5 bullet points highlighting the most important information
5. **Content Quality**: Assessment of the usefulness and relevance of the found content

Format your response in a clear, organized manner with proper headings and make it informative for someone interested in "${content.query}" on Xiaohongshu.

Focus on providing actionable insights and valuable information from the posts.`;
  }
} 