import { Message, ChatSession } from '../types';
import { createMessage } from '../utils';

export class PopupUI {
  private chatMessages: HTMLElement | null = null;
  private userInput: HTMLInputElement | null = null;
  private sendButton: HTMLElement | null = null;
  private settingsButton: HTMLElement | null = null;
  private onMessageSend?: (text: string) => void;

  constructor(onMessageSend?: (text: string) => void) {
    this.onMessageSend = onMessageSend;
  }

  initialize(): void {
    this.setupDOMElements();
    this.setupEventListeners();
  }

  private setupDOMElements(): void {
    this.chatMessages = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput') as HTMLInputElement;
    this.sendButton = document.getElementById('sendButton');
    this.settingsButton = document.getElementById('settingsButton');
  }

  private setupEventListeners(): void {
    if (this.userInput && this.sendButton) {
      this.sendButton.addEventListener('click', () => this.handleSendMessage());
      this.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSendMessage();
        }
      });
    }

    if (this.settingsButton) {
      this.settingsButton.addEventListener('click', () => {
        if ((chrome as any)?.runtime?.openOptionsPage) {
          (chrome as any).runtime.openOptionsPage();
        } else if ((chrome as any)?.runtime?.getURL) {
          window.open((chrome as any).runtime.getURL('settings.html'));
        }
      });
    }
  }

  private handleSendMessage(): void {
    if (!this.userInput) return;
    
    const text = this.userInput.value.trim();
    if (!text) return;
    
    // Clear input
    this.userInput.value = '';
    
    // Notify parent component
    if (this.onMessageSend) {
      this.onMessageSend(text);
    }
  }

  addMessageToChat(message: Message): void {
    if (!this.chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender}`;
    messageElement.textContent = message.text;
    messageElement.dataset.id = message.id;
    
    this.chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  renderMessages(messages: Message[]): void {
    if (!this.chatMessages) return;
    
    // Clear existing messages
    this.chatMessages.innerHTML = '';
    
    // Add each message to the UI
    messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.sender}`;
      messageElement.textContent = message.text;
      messageElement.dataset.id = message.id;
      
      if (this.chatMessages) {
        this.chatMessages.appendChild(messageElement);
      }
    });

    // Scroll to bottom
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }

  focusInput(): void {
    if (this.userInput) {
      this.userInput.focus();
    }
  }
} 