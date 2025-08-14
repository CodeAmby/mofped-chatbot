

export interface ChatAnalytics {
  query: string;
  responseTime: number;
  documentsFound: number;
  optionsClicked?: string;
  externalLinkClicked?: string;
  timestamp: Date;
  userAgent: string;
  sessionId: string;
}

class AnalyticsService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  trackQuery(analytics: ChatAnalytics) {
    // Send to Vercel Analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'chat_query', {
        event_category: 'chat',
        event_label: analytics.query,
        value: analytics.responseTime,
        custom_parameters: {
          documents_found: analytics.documentsFound,
          session_id: analytics.sessionId,
          user_agent: analytics.userAgent
        }
      });
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', analytics);
    }

    // Store in localStorage for session tracking
    this.storeSessionData(analytics);
  }

  trackOptionClick(optionText: string, query: string) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'option_click', {
        event_category: 'chat',
        event_label: optionText,
        custom_parameters: {
          original_query: query,
          session_id: this.sessionId
        }
      });
    }
  }

  trackExternalLink(link: string, originalQuery: string) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'external_link_click', {
        event_category: 'chat',
        event_label: link,
        custom_parameters: {
          original_query: originalQuery,
          session_id: this.sessionId
        }
      });
    }
  }

  private storeSessionData(analytics: ChatAnalytics) {
    if (typeof window !== 'undefined') {
      const sessionData = JSON.parse(localStorage.getItem('mofped_chat_session') || '[]');
      sessionData.push(analytics);
      
      // Keep only last 50 interactions
      if (sessionData.length > 50) {
        sessionData.splice(0, sessionData.length - 50);
      }
      
      localStorage.setItem('mofped_chat_session', JSON.stringify(sessionData));
    }
  }

  getSessionData(): ChatAnalytics[] {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('mofped_chat_session') || '[]');
    }
    return [];
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

export const analyticsService = new AnalyticsService();
