import { classifyIntent, IntentType } from './intent-classifier';
import { getMoFPEDLocation, getMoFPEDContacts, createMapsLink, scrapeFinanceGoUg, searchFinanceGoUg } from './web-scraper';
import { searchDocuments, generateResponse, type DocumentResult } from './rag-simple';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getLLM, hasAIConfigured } from "./get-llm";

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

export async function handleMoFPEDQuery(query: string, context: string[] = []): Promise<MoFPEDResponse> {
  const trimmedQuery = query.trim().toLowerCase();
  if (isGreeting(trimmedQuery)) {
    return getNaturalGreetingResponse(trimmedQuery);
  }

  const contextualQuery = buildContextualQuery(query, context);
  const intent = classifyIntent(contextualQuery);
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
          return await handleServiceQuery(query, contextualQuery);
        case 'document':
        default:
          return await handleDocumentQuery(query, contextualQuery);
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

function isGreeting(query: string): boolean {
  const greetings = [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good afternoon',
    'good evening',
    'greetings',
    'good day',
    'how are you',
    'how do you do'
  ];

  if (greetings.includes(query)) {
    return true;
  }

  if (greetings.some((g) => query.startsWith(g))) return true;
  if (/^(hi|hello|hey)[\s!.,?]*$/i.test(query)) return true;
  return false;
}

function getNaturalGreetingResponse(query: string): MoFPEDResponse {
  // Mirror the user's greeting naturally, then ask how we can help
  let greeting: string;
  if (query.includes('hey')) {
    greeting = "Hey! How can I help you today?";
  } else if (query.includes('hello')) {
    greeting = "Hello! What can I do for you?";
  } else if (query.includes('good morning')) {
    greeting = "Good morning! How can I assist you?";
  } else if (query.includes('good afternoon')) {
    greeting = "Good afternoon! What can I help you with?";
  } else if (query.includes('good evening')) {
    greeting = "Good evening! How can I help?";
  } else if (query.includes('how are you') || query.includes('how do you do')) {
    greeting = "I'm doing well, thanks for asking! What can I help you with today?";
  } else {
    // For "hi", "greetings", "good day", etc.
    greeting = "Hi there! What can I do for you?";
  }

  return {
    summary: greeting,
    sources: [],
    guardrail_status: "ok",
    intent: "document",
    confidence: 0.9,
    options: [
      { text: "Find a document", action: "document", query: "budget speech 2024" },
      { text: "Contact info", action: "contact", query: "contact phone email" },
      { text: "Office location", action: "location", query: "where is ministry of finance located" },
      { text: "Services", action: "service", query: "how to apply for services" }
    ]
  };
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

async function handleServiceQuery(query: string, searchQuery: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling service query');
  
  // Check if this is a generic service request
  const isGenericServiceRequest = query.toLowerCase().includes('how to apply for services') ||
                                 query.toLowerCase().includes('apply for services') ||
                                 query.toLowerCase().includes('services');
  
  if (isGenericServiceRequest) {
    return {
      summary: "I'd be happy to help you with MoFPED services! What specific service are you looking for?\n\nCommon services include:\n• Tax services and compliance\n• Budget and financial planning\n• Economic policy consultation\n• Procurement services\n• Investment facilitation\n\nPlease tell me which service you need help with, and I'll guide you through the application process.",
      sources: [{
        title: "MoFPED Services Guide",
        url: "https://www.finance.go.ug/services",
        category: "Service Information"
      }],
      guardrail_status: 'ok',
      intent: 'service',
      confidence: 0.9,
      options: [
        { text: "Tax Services", action: "service", query: "tax services application" },
        { text: "Budget Planning", action: "service", query: "budget planning services" },
        { text: "Procurement", action: "service", query: "procurement services" },
        { text: "Investment", action: "service", query: "investment facilitation" }
      ]
    };
  }
  
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
  const documents = await searchDocuments(searchQuery, 3);
  
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
    summary: "I couldn't find specific information about this service on the official website. Here are some suggestions:\n\n• Visit the official services page at finance.go.ug\n• Contact our support team for assistance\n• Browse our service categories below",
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
      { text: "Contact Support", action: "contact", query: "service support contact" },
      { text: "Tax Services", action: "service", query: "tax services application" },
      { text: "Budget Planning", action: "service", query: "budget planning services" }
    ]
  };
}

async function handleDocumentQuery(query: string, searchQuery: string): Promise<MoFPEDResponse> {
  console.log('[MoFPED] Handling document query');
  const queryYear = extractYear(query);
  const isBudgetQuery = query.toLowerCase().includes('budget');
  
  if (isMinisterQuery(query)) {
    const ministerAnswer = await answerMinisterQuery(query);
    if (ministerAnswer) {
      return ministerAnswer;
    }

    return {
      summary: "I couldn't confirm the current Minister of Finance from the official pages I checked. Would you like me to open the official leadership page?",
      sources: [{
        title: "MoFPED Leadership",
        url: "https://www.finance.go.ug/about-us",
        category: "Official Website"
      }],
      guardrail_status: 'not_found',
      intent: 'document',
      confidence: 0.3,
      options: [
        { text: "Open leadership page", action: "external", query: "https://www.finance.go.ug/about-us" }
      ]
    };
  }

  // Check if this is a generic document lookup request
  const isGenericRequest = query.toLowerCase().includes('download documents forms') || 
                          query.toLowerCase().includes('document lookup') ||
                          query.toLowerCase().includes('documents');
  
  if (isGenericRequest) {
    return {
      summary: "I'd be happy to help you find documents! What specific document are you looking for?\n\nFor example:\n• Budget Framework Paper\n• Application forms\n• Policy documents\n• Circulars\n• Reports\n\nJust tell me the name or type of document you need.",
      sources: [{
        title: "MoFPED Document Search",
        url: "https://www.finance.go.ug",
        category: "Document Search"
      }],
      guardrail_status: 'ok',
      intent: 'document',
      confidence: 0.9,
      options: [
        { text: "Budget Documents", action: "document", query: "budget framework paper" },
        { text: "Application Forms", action: "document", query: "application forms" },
        { text: "Policy Documents", action: "document", query: "policy documents" },
        { text: "Circulars", action: "document", query: "circulars" }
      ]
    };
  }
  
  // Use RAG search for specific document queries
  const documents = await searchDocuments(searchQuery, 5);
  
  if (documents.length === 0) {
    const broadenQuery = query.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
    const summary = queryYear
      ? `I couldn't find results for ${queryYear}. Want me to broaden the search?`
      : "I couldn't find results for that. Want me to broaden the search?";

    return {
      summary,
      sources: isBudgetQuery ? [{
        title: "MoFPED Budget Publications",
        url: "https://www.finance.go.ug/publications",
        category: "Official Website"
      }] : [{
        title: "Ministry of Finance Official Website",
        url: "https://www.finance.go.ug",
        category: "Official Website"
      }],
      guardrail_status: 'not_found',
      intent: 'document',
      confidence: 0.4,
      options: [
        { text: "Broaden search", action: "document", query: broadenQuery || query },
        { text: "Budget documents", action: "document", query: "budget documents" },
        { text: "Application forms", action: "document", query: "application forms" },
        { text: "Policy documents", action: "document", query: "policy documents" }
      ]
    };
  }

  if (isDocumentQuestionAboutSpeaker(query)) {
    const speakerAnswer = await answerBudgetSpeechSpeaker(query);
    if (speakerAnswer) {
      return speakerAnswer;
    }
  }

  const questionType = detectQuestionType(query);
  if (questionType) {
    const qaAnswer = await answerWhQuestion(questionType, query, documents);
    if (qaAnswer) {
      return qaAnswer;
    }
  }

  if (isMinisterQuery(query)) {
    const ministerAnswer = await answerMinisterQuery(query);
    if (ministerAnswer) {
      return ministerAnswer;
    }
  }

  // Try to generate a direct answer from document content (instead of generic "Is this what you're looking for?")
  const directAnswer = await tryDirectAnswerFromDocuments(query, documents);
  if (directAnswer) {
    return directAnswer;
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

async function tryDirectAnswerFromDocuments(
  query: string,
  documents: DocumentResult[]
): Promise<MoFPEDResponse | null> {
  if (documents.length === 0 || !hasAIConfigured()) return null;

  const topDoc = documents[0];
  if (!topDoc?.url) return null;

  const scraped = await scrapeFinanceGoUg(topDoc.url);
  if (!scraped?.content || scraped.content.length < 100) return null;

  const answer = await formatConversationalAnswer(query, scraped.content);
  if (!answer || answer.toLowerCase().includes("couldn't find a direct answer")) return null;

  return {
    summary: answer,
    sources: documents.slice(0, 3).map((doc) => ({
      title: doc.title,
      url: doc.url,
      category: doc.category || "Official Document"
    })),
    guardrail_status: "ok",
    intent: "document",
    confidence: 0.8,
    options: documents.slice(0, 3).map((doc) => ({
      text: "Open full document",
      action: "external",
      query: doc.url
    }))
  };
}

function buildContextualQuery(query: string, context: string[]): string {
  const cleanedContext = context
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .filter((item) => !isGreeting(item.toLowerCase()))
    .filter((item) => !/^(yes|yeah|yep|ok|okay|no|nope|nah)\b/i.test(item))
    .slice(-4);

  if (cleanedContext.length === 0) {
    return query;
  }

  const queryHasYear = extractYear(query) !== null;
  const queryHasTopic = hasTopicKeywords(query);
  const contextYear = extractYear(cleanedContext.slice(-1)[0] ?? "");
  const queryWordCount = query.trim().split(/\s+/).length;
  const isFollowUp = /\b(those|them|that|this|same|another|others|more|else|previous|above|how about|what about)\b/i.test(query);

  let mergedQuery = query;
  const lastContext = cleanedContext[cleanedContext.length - 1];

  if (queryHasYear && !queryHasTopic && lastContext) {
    mergedQuery = `${lastContext} ${mergedQuery}`;
  }

  if (!queryHasYear && contextYear) {
    mergedQuery = `${mergedQuery} ${contextYear}`;
  }

  if (isFollowUp || queryWordCount < 4) {
    mergedQuery = `${mergedQuery}. Related context: ${cleanedContext.join('; ')}`;
  }

  return mergedQuery;
}

function hasTopicKeywords(query: string): boolean {
  return /\b(budget|speech|circular|document|report|paper|form|policy|tax|contact|service|location)\b/i.test(query);
}

function extractYear(query: string): string | null {
  const match = query.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

type QuestionType = 'who' | 'what' | 'when' | 'where' | 'why' | 'how';

function detectQuestionType(query: string): QuestionType | null {
  const lower = query.trim().toLowerCase();
  if (lower.startsWith('who ')) return 'who';
  if (lower.startsWith('what ')) return 'what';
  if (lower.startsWith('when ')) return 'when';
  if (lower.startsWith('where ')) return 'where';
  if (lower.startsWith('why ')) return 'why';
  if (lower.startsWith('how ')) return 'how';
  return null;
}

function isDocumentQuestionAboutSpeaker(query: string): boolean {
  return /\b(who|whom)\b.*\b(deliver|delivered|presented|read)\b/i.test(query);
}

function isMinisterQuery(query: string): boolean {
  return /\bminister\b/i.test(query) && /\bfinance\b/i.test(query);
}

async function answerWhQuestion(
  questionType: QuestionType,
  query: string,
  documents: Array<{ title: string; url: string; category: string | null }>
): Promise<MoFPEDResponse | null> {
  const candidate = documents[0];
  if (!candidate?.url) {
    return null;
  }

  const scraped = await scrapeFinanceGoUg(candidate.url);
  if (!scraped?.content) {
    return null;
  }

  const extracted = extractAnswerFromContent(questionType, query, scraped.content);
  if (!extracted) {
    const clarification = await formatConversationalAnswer(query, scraped.content);
    if (!clarification) {
      return null;
    }
    return {
      summary: clarification,
      sources: [{
        title: candidate.title,
        url: candidate.url,
        category: candidate.category || "Official Document"
      }],
      guardrail_status: 'ok',
      intent: 'document',
      confidence: 0.55,
      options: [
        { text: "Open full document", action: "external", query: candidate.url }
      ]
    };
  }

  return {
    summary: extracted,
    sources: [{
      title: candidate.title,
      url: candidate.url,
      category: candidate.category || "Official Document"
    }],
    guardrail_status: 'ok',
    intent: 'document',
    confidence: 0.75,
    options: [
      { text: "Open full document", action: "external", query: candidate.url }
    ]
  };
}

function extractAnswerFromContent(questionType: QuestionType, query: string, content: string): string | null {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 40 && sentence.length < 300);

  const keywords = extractQueryKeywords(query);
  const bestSentence = sentences.find((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
  );

  if (!bestSentence) {
    return null;
  }

  if (questionType === 'when') {
    const dateMatch = bestSentence.match(/\b\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b|\b(20\d{2}|19\d{2})\b/);
    if (dateMatch) {
      return `It happened in ${dateMatch[0]}.`;
    }
  }

  if (questionType === 'who') {
    const personMatch = bestSentence.match(/\b(Rt\.?\s*Hon\.?|Hon\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/);
    if (personMatch) {
      return `${personMatch[0]} is referenced in the document.`;
    }
  }

  return bestSentence.trim();
}

async function formatConversationalAnswer(question: string, content: string): Promise<string | null> {
  if (!hasAIConfigured()) {
    return "I couldn't find a direct answer in the document. Do you want to clarify the year or the specific document?";
  }

  let llm;
  try {
    llm = getLLM();
  } catch {
    return "I couldn't find a direct answer in the document. Do you want to clarify the year or the specific document?";
  }

  const contextSnippet = content.replace(/\s+/g, ' ').trim().slice(0, 1200);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are the MoFPED Help Assistant. Use the provided context to answer the user's question. " +
        "Be concise, conversational, and match synonyms (e.g., speech/document/report). " +
        "If the context does not contain the answer, ask for clarification about the year or topic instead of saying you don't understand."
    ],
    ["human", "Question: {question}\nContext: {context}"]
  ]);

  const response = await llm.invoke(
    await prompt.formatMessages({
      question,
      context: contextSnippet
    })
  );

  const text = response.content?.toString().trim();
  return text || null;
}

function extractQueryKeywords(query: string): string[] {
  const stopwords = new Set(['who', 'what', 'when', 'where', 'why', 'how', 'is', 'are', 'the', 'a', 'an', 'of', 'for', 'to', 'about', 'from']);
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word));
}

async function answerMinisterQuery(query: string): Promise<MoFPEDResponse | null> {
  const results = await searchFinanceGoUg('minister of finance', 5);
  if (results.length === 0) {
    return null;
  }

  const candidate = results.find((result) => /minister/i.test(result.title)) ?? results[0];
  const scraped = await scrapeFinanceGoUg(candidate.url);
  if (!scraped?.content) {
    return null;
  }

  const ministerName = extractMinisterName(scraped.content);
  if (!ministerName) {
    return null;
  }

  return {
    summary: `${ministerName} is the Minister of Finance, Planning and Economic Development.`,
    sources: [{
      title: candidate.title,
      url: candidate.url,
      category: "Official Website"
    }],
    guardrail_status: 'ok',
    intent: 'document',
    confidence: 0.85,
    options: [
      { text: "Open full document", action: "external", query: candidate.url }
    ]
  };
}

function extractMinisterName(content: string): string | null {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  const patterns = [
    /Minister of Finance[^\\.]{0,80}\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/i,
    /\b(Rt\.?\s*Hon\.?|Hon\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b.*?Minister of Finance/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const name = match[2] ? `${match[1]} ${match[2]}` : match[1];
      return name.trim();
    }
  }

  return null;
}

async function answerBudgetSpeechSpeaker(query: string): Promise<MoFPEDResponse | null> {
  const year = extractYear(query);
  const results = await searchFinanceGoUg("budget speech", 8);
  const budgetResults = results.filter((result) => result.title.toLowerCase().includes("budget speech"));
  if (budgetResults.length === 0) {
    return null;
  }

  const matching = year ? filterBudgetSpeechByYear(budgetResults, year) : budgetResults;
  if (year && matching.length === 0) {
    return {
      summary: `I couldn't find a budget speech for ${year} on finance.go.ug. Here are the closest available budget speeches.`,
      sources: budgetResults.slice(0, 3).map((result) => ({
        title: result.title,
        url: result.url,
        category: "Official Website"
      })),
      guardrail_status: 'not_found',
      intent: 'document',
      confidence: 0.4,
      options: budgetResults.slice(0, 3).map((result) => ({
        text: "Open full document",
        action: "external",
        query: result.url
      }))
    };
  }

  const candidate = matching[0];
  const scraped = await scrapeFinanceGoUg(candidate.url);
  if (!scraped?.content) {
    return null;
  }

  const speaker = extractSpeakerFromContent(scraped.content);
  if (!speaker) {
    return {
      summary: "I found the budget speech page, but I couldn't confirm the speaker from the page content. Want to open the full document?",
      sources: [{
        title: candidate.title,
        url: candidate.url,
        category: "Official Website"
      }],
      guardrail_status: 'ok',
      intent: 'document',
      confidence: 0.4,
      options: [
        { text: "Open full document", action: "external", query: candidate.url }
      ]
    };
  }

  return {
    summary: `${speaker} delivered the budget speech.`,
    sources: [{
      title: candidate.title,
      url: candidate.url,
      category: "Official Website"
    }],
    guardrail_status: 'ok',
    intent: 'document',
    confidence: 0.85,
    options: [
      { text: "Open full document", action: "external", query: candidate.url }
    ]
  };
}

function filterBudgetSpeechByYear(results: Array<{ title: string; url: string }>, year: string) {
  return results.filter((result) => {
    const candidate = `${result.title} ${result.url}`.toLowerCase();
    if (candidate.includes(year)) {
      return true;
    }
    const fyMatch = candidate.match(/(20\d{2})\s*\/\s*(20\d{2})/);
    if (fyMatch) {
      return fyMatch[1] === year || fyMatch[2] === year;
    }
    const shortMatch = candidate.match(/(20\d{2})\s*\/\s*(\d{2})/);
    if (shortMatch) {
      const endYear = `20${shortMatch[2]}`;
      return shortMatch[1] === year || endYear === year;
    }
    return false;
  });
}

function extractSpeakerFromContent(content: string): string | null {
  const cleaned = content.replace(/\s+/g, ' ').trim();

  const explicitMatch = cleaned.match(/\b(?:delivered|presented|read)\s+by\s+([^\\.]{5,80})/i);
  if (explicitMatch) {
    const candidate = trimSpeakerName(explicitMatch[1]);
    return isLikelyPersonName(candidate) ? candidate : null;
  }

  const honourableMatch = cleaned.match(/\b(Rt\.?\s*Hon\.?|Hon\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/);
  if (honourableMatch) {
    const candidate = `${honourableMatch[1]} ${honourableMatch[2]}`.trim();
    return isLikelyPersonName(candidate) ? candidate : null;
  }

  const ministerMatch = cleaned.match(/\b(Minister|Minister of Finance)[^\\.]{0,60}\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/);
  if (ministerMatch) {
    const candidate = ministerMatch[2].trim();
    return isLikelyPersonName(candidate) ? candidate : null;
  }

  return null;
}

function isLikelyPersonName(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  const blacklist = ['governance', 'implementation', 'plan', 'development', 'budget', 'speech', 'ministry'];
  if (blacklist.some((term) => lower.includes(term))) {
    return false;
  }
  const words = name.split(/\s+/);
  if (words.length < 2) {
    return false;
  }
  return words.every((word) => /^[A-Z]/.test(word) || /^Rt\.?$/.test(word) || /^Hon\.?$/.test(word));
}

function trimSpeakerName(name: string): string {
  return name
    .replace(/\b(the|for|of|on)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
