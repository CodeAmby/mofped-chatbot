import { classifyIntent, IntentType } from './intent-classifier';
import { getMoFPEDLocation, getMoFPEDContacts, createMapsLink, scrapeFinanceGoUg } from './web-scraper';
import { searchDocuments, generateResponse } from './rag-simple';

export interface MoFPEDResponse {
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    category?: string;
  }>;
  guardrail_status: 'ok' | 'not_found' | 'error';
  options?: Array<{
    text: string;
    action: string;
    query: string;
  }>;
  intent?: IntentType;
  confidence?: number;
}

export async function handleMoFPEDQuery(query: string): Promise<MoFPEDResponse> {
  const intent = classifyIntent(query);
  console.log(`[MoFPED] Intent classified as: ${intent.intent} (confidence: ${intent.confidence})`);

  // Add a timeout wrapper for all operations
  const timeoutPromise = new Promise<MoFPEDResponse>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
  });

  try {
    const responsePromise = (async () => {
      switch (intent.intent) {
        case 'location':
          return await handleLocationQuery(query);
        case 'contact':
          return await handleContactQuery(query);
        case 'service':
          return await handleServiceQuery(query);
        case 'document':
        default:
          return await handleDocumentQuery(query);
      }
    })();

    return await Promise.race([responsePromise, timeoutPromise]);
  } catch (error) {
    console.error('[MoFPED] Error handling query:', error);
    return {
      summary: "I apologize, but I encountered an error while processing your request. Please try again or contact our support team.",
      sources: [],
      guardrail_status: 'error',
      intent: intent.intent,
      confidence: intent.confidence
    };
  }
}

async function handleLocationQuery(query: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling location query');
  
  const locationInfo = await getMoFPEDLocation();
  
  if (!locationInfo) {
    return {
      summary: "I'm unable to access the current location information from the official website at the moment. Please visit https://www.finance.go.ug/contact-us for the most up-to-date address and contact details.",
      sources: [{
        title: "Ministry of Finance Contact Page",
        url: "https://www.finance.go.ug/contact-us",
        category: "Official Website"
      }],
      guardrail_status: 'not_found',
      intent: 'location',
      confidence: 0.8
    };
  }

  const mapsLink = createMapsLink(locationInfo.address);
  
  let summary = `Here's the official physical address for the Ministry of Finance headquarters.\n\n`;
  summary += `Address: ${locationInfo.address}\n`;
  
  if (locationInfo.hours) {
    summary += `Hours: ${locationInfo.hours}\n`;
  }
  
  if (locationInfo.phone || locationInfo.email) {
    summary += `Contact: `;
    if (locationInfo.phone) summary += `Phone: ${locationInfo.phone} `;
    if (locationInfo.email) summary += `Email: ${locationInfo.email}`;
    summary += `\n`;
  }
  
  summary += `Last checked: ${locationInfo.lastChecked}`;

  return {
    summary,
    sources: [{
      title: "Ministry of Finance Official Website",
      url: "https://www.finance.go.ug",
      category: "Official Source"
    }],
    guardrail_status: 'ok',
    intent: 'location',
    confidence: 0.95,
    options: [
      { text: "Get Directions", action: "external", query: mapsLink },
      { text: "Contact Information", action: "contact", query: "contact phone email" }
    ]
  };
}

async function handleContactQuery(query: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling contact query');
  
  const contacts = await getMoFPEDContacts();
  
  if (contacts.length === 0) {
    return {
      summary: "I'm unable to access the current contact information from the official website at the moment. Please visit https://www.finance.go.ug/contact-us for the most up-to-date contact details.",
      sources: [{
        title: "Ministry of Finance Contact Page",
        url: "https://www.finance.go.ug/contact-us",
        category: "Official Website"
      }],
      guardrail_status: 'not_found',
      intent: 'contact',
      confidence: 0.8
    };
  }

  let summary = "Here are the official contact details for the Ministry of Finance:\n\n";
  
  contacts.forEach((contact, index) => {
    if (contact.department) {
      summary += `${contact.department}\n`;
    }
    if (contact.phone) {
      summary += `Phone: ${contact.phone}\n`;
    }
    if (contact.email) {
      summary += `Email: ${contact.email}\n`;
    }
    if (contact.hours) {
      summary += `Hours: ${contact.hours}\n`;
    }
    if (index < contacts.length - 1) summary += '\n';
  });

  return {
    summary,
    sources: [{
      title: "Ministry of Finance Contact Information",
      url: "https://www.finance.go.ug/contact-us",
      category: "Official Source"
    }],
    guardrail_status: 'ok',
    intent: 'contact',
    confidence: 0.9,
    options: [
      { text: "Visit Contact Page", action: "external", query: "https://www.finance.go.ug/contact-us" },
      { text: "Office Location", action: "location", query: "where is ministry of finance located" }
    ]
  };
}

async function handleServiceQuery(query: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling service query');
  
  // First try to find information on official service pages
  const serviceUrls = [
    'https://www.finance.go.ug/services',
    'https://www.finance.go.ug/how-to-apply',
    'https://www.gov.ug/services'
  ];

  for (const url of serviceUrls) {
    const scraped = await scrapeFinanceGoUg(url);
    if (scraped && scraped.content.toLowerCase().includes(query.toLowerCase().split(' ')[0])) {
      return {
        summary: `I found relevant service information on the official website. Here's what I found:\n\n${scraped.content.substring(0, 500)}...\n\nFor complete details, please visit the official service page.`,
        sources: [{
          title: scraped.title,
          url: scraped.url,
          category: "Official Service Page"
        }],
        guardrail_status: 'ok',
        intent: 'service',
        confidence: 0.85,
        options: [
          { text: "View Full Service Page", action: "external", query: scraped.url },
          { text: "Contact Support", action: "contact", query: "service support contact" }
        ]
      };
    }
  }

  // Fallback to RAG search for service-related documents
  const documents = await searchDocuments(query, 3);
  
  if (documents.length > 0) {
    const response = generateResponse(query, documents);
      return {
    ...response,
    intent: 'service',
    confidence: 0.7,
    sources: response.sources.map(s => ({
      title: s.title,
      url: s.url,
      category: s.category || undefined
    }))
  };
  }

  return {
    summary: "I couldn't find specific information about this service on the official website. Please visit https://www.finance.go.ug/services or contact our support team for assistance.",
    sources: [{
      title: "Ministry of Finance Services",
      url: "https://www.finance.go.ug/services",
      category: "Official Website"
    }],
    guardrail_status: 'not_found',
    intent: 'service',
    confidence: 0.6,
    options: [
      { text: "Browse Services", action: "external", query: "https://www.finance.go.ug/services" },
      { text: "Contact Support", action: "contact", query: "service support contact" }
    ]
  };
}

async function handleDocumentQuery(query: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling document query');
  
  // Use RAG search for document/policy queries
  const documents = await searchDocuments(query, 5);
  
  if (documents.length === 0) {
    return {
      summary: "I couldn't find the specific document you're looking for in our database. Please check the official website at https://www.finance.go.ug for the most current documents and policies.",
      sources: [{
        title: "Ministry of Finance Official Website",
        url: "https://www.finance.go.ug",
        category: "Official Website"
      }],
      guardrail_status: 'not_found',
      intent: 'document',
      confidence: 0.5
    };
  }

  const response = generateResponse(query, documents);
  return {
    ...response,
    intent: 'document',
    confidence: 0.8,
    sources: response.sources.map(s => ({
      title: s.title,
      url: s.url,
      category: s.category || undefined
    }))
  };
}
