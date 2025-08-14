(function() {
  'use strict';
  
  // Configuration
  const config = {
    apiUrl: 'https://mofped-chatbot.vercel.app/api/ask',
    position: 'bottom-right',
    primaryColor: '#103B73',
    secondaryColor: '#2E7D32',
    theme: 'light'
  };

  // Load CSS
  function loadCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://mofped-chatbot.vercel.app/widget.css';
    link.type = 'text/css';
    document.head.appendChild(link);
  }

  // Load the widget
  function loadWidget() {
    const script = document.createElement('script');
    script.src = 'https://mofped-chatbot.vercel.app/widget.js';
    script.async = true;
    script.onload = function() {
      if (window.MoFPEDChatWidget) {
        window.MoFPEDChatWidget.init(config);
      }
    };
    document.head.appendChild(script);
  }

  // Analytics tracking
  function trackEvent(eventName, data) {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, {
        event_category: 'mofped_chat',
        event_label: data.query || data.action,
        custom_parameters: data
      });
    }
  }

  // Initialize
  function init() {
    // Load CSS first
    loadCSS();
    
    // Load widget after CSS
    setTimeout(loadWidget, 100);
    
    // Track widget load
    trackEvent('widget_loaded', {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose tracking function globally
  window.MoFPEDChatTrack = trackEvent;
})();
