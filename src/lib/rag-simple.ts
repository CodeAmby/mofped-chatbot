import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { searchFinanceGoUg } from './web-scraper';
import { searchHybrid, selectTopWithThreshold } from './rag';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    return null;
  }

  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export interface DocumentResult {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  contentType: string;
  publishDate: string | null;
  relevance: number;
  excerpt: string | null;
}

export async function embedQuery(text: string): Promise<number[]> {
  const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
  return embeddings.embedQuery(text);
}

export async function searchDocuments(query: string, limit = 5): Promise<DocumentResult[]> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return await searchFinanceFallback(normalizeQuery(query), limit);
    }

    const normalizedQuery = normalizeQuery(query);
    console.log(`[search] Query: "${query}" -> "${normalizedQuery}"`);
    
      // Since we don't have embeddings, focus on keyword search
  // Split query into words for better matching
  const queryWords = normalizedQuery.toLowerCase().split(' ').filter(word => word.length > 2);
  let keywordResults = null;
  let keywordError = null;

  if (queryWords.length > 1) {
    // For multi-word queries, try to match any of the words
    const orConditions = queryWords.map(word => 
      `title.ilike.%${word}%,description.ilike.%${word}%,category.ilike.%${word}%`
    ).join(',');
    
    const { data, error } = await supabase
      .from('Document')
      .select('id, title, url, description, category, contentType, publishDate')
      .eq('isActive', true)
      .or(orConditions)
      .order('publishDate', { ascending: false })
      .limit(limit);
    
    keywordResults = data;
    keywordError = error;
  } else {
    // For single word queries, use the original logic
    const { data, error } = await supabase
      .from('Document')
      .select('id, title, url, description, category, contentType, publishDate')
      .eq('isActive', true)
      .or(`title.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%,category.ilike.%${normalizedQuery}%`)
      .order('publishDate', { ascending: false })
      .limit(limit);
    
    keywordResults = data;
    keywordError = error;
  }

    if (keywordError) {
      console.error('Keyword search error:', keywordError);
      return [];
    }

    console.log(`[search] Keyword search found ${keywordResults?.length || 0} documents`);
    if (keywordResults && keywordResults.length > 0) {
      console.log(`[search] Keyword results:`, keywordResults.map(d => ({ title: d.title, category: d.category })));
    }

    // Also search in excerpts for better matching
    const { data: excerptResults, error: excerptError } = await supabase
      .from('DocumentExcerpt')
      .select(`
        id,
        excerpt,
        relevance,
        document:Document(
          id,
          title,
          url,
          description,
          category,
          contentType,
          publishDate
        )
      `)
      .or(`excerpt.ilike.%${normalizedQuery}%,keywords.cs.{${normalizedQuery}}`)
      .order('relevance', { ascending: false })
      .limit(limit);

    if (excerptError) {
      console.error('Excerpt search error:', excerptError);
    }

    console.log(`[search] Excerpt search found ${excerptResults?.length || 0} results`);

    // Combine and deduplicate results
    const results = new Map<string, DocumentResult>();
    
    // Add excerpt results first (higher relevance)
    excerptResults?.forEach(result => {
      if (result.document) {
        results.set(result.document.id, {
          id: result.document.id,
          title: result.document.title,
          url: result.document.url,
          description: result.document.description,
          category: result.document.category,
          contentType: result.document.contentType,
          publishDate: result.document.publishDate,
          relevance: result.relevance,
          excerpt: result.excerpt
        });
      }
    });

    // Add keyword results (with lower relevance)
    keywordResults?.forEach(doc => {
      if (!results.has(doc.id)) {
        results.set(doc.id, {
          id: doc.id,
          title: doc.title,
          url: doc.url,
          description: doc.description,
          category: doc.category,
          contentType: doc.contentType,
          publishDate: doc.publishDate,
          relevance: 0.5, // Lower relevance for keyword matches
          excerpt: null
        });
      }
    });

    const finalResults = Array.from(results.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    console.log(`[search] Final results: ${finalResults.length} documents`);
    if (finalResults.length > 0) {
      return finalResults;
    }

    const semanticResults = await searchSemanticFallback(normalizeQuery(query), limit);
    if (semanticResults.length > 0) {
      return semanticResults;
    }

    return await searchFinanceFallback(normalizeQuery(query), limit);

  } catch (error) {
    console.error('Search error:', error);
    const semanticResults = await searchSemanticFallback(normalizeQuery(query), limit);
    if (semanticResults.length > 0) {
      return semanticResults;
    }
    return await searchFinanceFallback(normalizeQuery(query), limit);
  }
}

async function searchFinanceFallback(query: string, limit: number): Promise<DocumentResult[]> {
  const results = await searchFinanceGoUg(query, limit);
  if (results.length === 0) {
    return [];
  }

  return results.map((result) => ({
    id: result.url,
    title: result.title,
    url: result.url,
    description: result.snippet || null,
    category: "Official Website Search",
    contentType: "web",
    publishDate: null,
    relevance: 0.4,
    excerpt: result.snippet || null
  }));
}

async function searchSemanticFallback(query: string, limit: number): Promise<DocumentResult[]> {
  try {
    const rows = await searchHybrid(query, limit * 3);
    const top = selectTopWithThreshold(rows, limit);
    if (top.length === 0) {
      return [];
    }

    return top.map((row) => ({
      id: row.documentId,
      title: row.title || "Untitled Document",
      url: row.url,
      description: row.content.slice(0, 200),
      category: row.section || "Document",
      contentType: "document",
      publishDate: null,
      relevance: Math.max(0.1, 1 - row.score),
      excerpt: row.content.slice(0, 240)
    }));
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

function normalizeQuery(query: string): string {
  const cleaned = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const leadingPhrases = [
    /^please\s+/,
    /^please\s+give\s+me\s+/,
    /^can\s+you\s+/,
    /^could\s+you\s+/,
    /^would\s+you\s+/,
    /^i\s+need\s+/,
    /^i\s+want\s+/,
    /^i\s+would\s+like\s+/,
    /^show\s+me\s+/,
    /^give\s+me\s+/,
    /^find\s+me\s+/
  ];

  let normalized = cleaned;
  leadingPhrases.forEach((pattern) => {
    normalized = normalized.replace(pattern, '');
  });

  normalized = normalized
    .replace(/\bbudget\s+(docs|doc)\b/g, 'budget document')
    .replace(/\b(docs|doc)\b/g, 'document')
    .replace(/\b(please|me|the|a|an|for|to|of|about|from)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || cleaned;
}

export function generateResponse(query: string, documents: DocumentResult[]): {
  summary: string;
  sources: Array<{ title: string; url: string; category: string | null; description?: string }>;
  guardrail_status: string;
  options?: Array<{ text: string; action: string; query: string }>;
} {
  // Check for specific query types
  const queryLower = query.toLowerCase();
  const queryYear = extractYear(queryLower);
  const isContactQuery = queryLower.includes('contact') || queryLower.includes('phone') || queryLower.includes('email') || queryLower.includes('number') || queryLower.includes('support');
  const isIFMSQuery = queryLower.includes('ifms');
  const isEGPQuery = queryLower.includes('egp') || queryLower.includes('procurement');
  const isBudgetQuery = queryLower.includes('budget');
  const isURAQuery = queryLower.includes('ura') || queryLower.includes('revenue') || queryLower.includes('tax');
  	// const isBOUQuery = queryLower.includes('bou') || queryLower.includes('bank of uganda') || queryLower.includes('central bank');
  const isPBSQuery = queryLower.includes('pbs') || queryLower.includes('programme based system') || queryLower.includes('programme based');
  const isCFPQuery = queryLower.includes('cfp') || queryLower.includes('climate finance') || queryLower.includes('climate');

  // Handle PBS and CFP queries that don't require document search


  if (documents.length === 0) {
    return {
      summary: "I couldn't find any relevant documents on finance.go.ug for your query. Try searching for different terms or browse our document categories.",
      sources: [],
      guardrail_status: "not_found"
    };
  }

  // Group documents by category
  const byCategory = documents.reduce((acc, doc) => {
    const category = doc.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, DocumentResult[]>);

  // Handle specific contact queries
  if (isContactQuery && isIFMSQuery) {
    const ifmsContact = documents.find(doc => doc.title.toLowerCase().includes('ifms') && doc.category === 'Contact Information');
    if (ifmsContact) {
      return {
        summary: `Here's the IFMS Contact Center information:\n\n**IFMS Contact Center**\nPhone: +256 414 230 000\nEmail: support@ifms.go.ug\n\nFor technical support, system access, and user assistance with the Integrated Financial Management System.`,
        sources: [{
          title: ifmsContact.title,
          url: ifmsContact.url,
          category: ifmsContact.category
        }],
        guardrail_status: "ok"
      };
    }
  }

  if (isContactQuery && isEGPQuery) {
    const egpContact = documents.find(doc => 
      (doc.title.toLowerCase().includes('egp') || doc.title.toLowerCase().includes('procurement')) && 
      doc.category === 'Contact Information'
    );
    if (egpContact) {
      return {
        summary: `Here's the EGP Support contact information:\n\n**EGP Support Contact**\nPhone: +256 414 230 000\nEmail: egp-support@egp.go.ug\n\nFor procurement-related queries and technical assistance with the Electronic Government Procurement portal.`,
        sources: [{
          title: egpContact.title,
          url: egpContact.url,
          category: egpContact.category
        }],
        guardrail_status: "ok"
      };
    }
  }

  // Handle general topic queries with conversational options
  if (isEGPQuery && !isContactQuery) {
    const egpSystem = documents.find(doc => doc.title.toLowerCase().includes('egp') && doc.category === 'External Systems');
    const egpContact = documents.find(doc => doc.title.toLowerCase().includes('egp') && doc.category === 'Contact Information');
    
    if (egpSystem) {
      const desc = (egpSystem.description || egpSystem.excerpt || "").substring(0, 150);
      return {
        summary: desc
          ? `The Electronic Government Procurement (EGP) Portal is for procurement processes. ${desc}…`
          : "The EGP portal handles government procurement. You can access it for tenders and supplier registration.",
        sources: [{ title: egpSystem.title, url: egpSystem.url, category: egpSystem.category }],
        guardrail_status: "ok",
        options: [
          { text: "Open EGP portal", action: "external", query: "https://egpuganda.go.ug/" },
          ...(egpContact ? [{ text: "Contact support", action: "contact", query: "EGP contact" }] : [])
        ]
      };
    }
  }

  if (isBudgetQuery && !isContactQuery) {
    const budgetPortal = documents.find(doc => doc.title.toLowerCase().includes('budget portal') && doc.category === 'External Systems');
    const budgetDocs = documents.filter(doc => doc.category === 'Budget');
    // Also match docs with budget/speech in title (RAG may use different categories)
    const budgetByTitle = documents.filter(doc => {
      const t = (doc.title || "").toLowerCase();
      return t.includes('budget') || t.includes('speech') || (doc.url || "").toLowerCase().includes('budget');
    });
    const budgetSources = budgetPortal ? [budgetPortal] : (budgetDocs.length > 0 ? budgetDocs : budgetByTitle).slice(0, 3);
    
    if (budgetSources.length > 0) {
      const top = budgetSources[0];
      const desc = (top?.description || top?.excerpt || "").substring(0, 120);
      return {
        summary: desc
          ? `Budget resources: ${desc}…`
          : "I found budget documents — framework papers, speeches, and implementation reports.",
        sources: budgetSources.map(doc => ({
          title: doc.title,
          url: doc.url,
          category: doc.category,
          description: (doc.excerpt || doc.description || "").substring(0, 150).trim() || undefined
        })),
        guardrail_status: "ok"
        // No options - sources have the links; avoids duplication
      };
    }
    // No matching docs from RAG — return guaranteed budget links so the option always works
    return {
      summary: "Here are the official budget resources. You can browse budget speeches, framework papers, and fiscal documents by year.",
      sources: [
        { title: "Uganda Budget Information", url: "https://budget.go.ug", category: "Budget", description: "Browse budget documents by fiscal year (FY 2009-10 to FY 2026-27)" },
        { title: "MoFPED Budget Publications", url: "https://www.finance.go.ug/publications", category: "Budget", description: "Budget framework papers, speeches, and implementation reports" }
      ],
      guardrail_status: "ok"
    };
  }

  if (isIFMSQuery && !isContactQuery) {
    const ifmsContact = documents.find(doc => doc.title.toLowerCase().includes('ifms') && doc.category === 'Contact Information');
    
    if (ifmsContact) {
      return {
        summary: "IFMS is Uganda's Integrated Financial Management System for government accounting and reporting. For support: +256 414 230 000 or support@ifms.go.ug.",
        sources: [{ title: ifmsContact.title, url: ifmsContact.url, category: ifmsContact.category }],
        guardrail_status: "ok",
        options: [
          { text: "e-Registration", action: "external", query: "https://ereg.ifms.go.ug/menu.php?page=menu" }
        ]
      };
    }
  }

  if (isURAQuery && !isContactQuery) {
    const uraSystem = documents.find(doc => doc.title.toLowerCase().includes('ura') && doc.category === 'External Systems');
    
    if (uraSystem) {
      return {
        summary: "URA handles tax, customs, and revenue. Visit ura.go.ug for filing, payments, and compliance.",
        sources: [{ title: uraSystem.title, url: uraSystem.url, category: uraSystem.category }],
        guardrail_status: "ok",
        options: [{ text: "Open URA website", action: "external", query: uraSystem.url }]
      };
    }
  }

  if (isPBSQuery && !isContactQuery) {
    return {
      summary: "PBS is the Programme Based System for budgeting and financial management. Authorized users can log in at pbsmof.finance.go.ug.",
      sources: [{ title: "Programme Based System (PBS)", url: "https://pbsmof.finance.go.ug/auth/login", category: "External Systems" }],
      guardrail_status: "ok",
      options: [{ text: "Open PBS portal", action: "external", query: "https://pbsmof.finance.go.ug/auth/login" }]
    };
  }

  if (isCFPQuery && !isContactQuery) {
    return {
      summary: "The Climate Finance Platform tracks climate finance. Log in at climate.finance.go.ug for authorized users.",
      sources: [{ title: "Climate Finance Platform (CFP)", url: "https://climate.finance.go.ug/user/login", category: "External Systems" }],
      guardrail_status: "ok",
      options: [{ text: "Open CFP portal", action: "external", query: "https://climate.finance.go.ug/user/login" }]
    };
  }

  // Sources with description - no separate "Open document" buttons (avoids duplication)
  const sources = documents.map(doc => ({
    title: doc.title,
    url: doc.url,
    category: doc.category,
    description: (doc.excerpt || doc.description || "").substring(0, 150).trim() || undefined
  }));

  if (queryYear) {
    const matchesYear = documents.some((doc) => {
      const haystack = `${doc.title} ${doc.url}`.toLowerCase();
      return haystack.includes(queryYear);
    });

    if (!matchesYear) {
      const broadenedQuery = query.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
      return {
        summary: `I couldn't find results for ${queryYear}. Here are the closest matches. Is this what you're looking for?`,
        sources,
        guardrail_status: "ok",
        options: [
          { text: "Broaden search", action: "document", query: broadenedQuery || query }
        ]
      };
    }
  }

  const topDoc = documents[0];
  const briefSummary = (topDoc.excerpt || topDoc.description || topDoc.title || "").trim();
  const docBrief = briefSummary ? briefSummary.substring(0, 180) + (briefSummary.length > 180 ? "…" : "") : null;
  const summaryText = docBrief
    ? `I found ${topDoc.title} — ${docBrief}`
    : `I found ${topDoc.title}.`;

  return {
    summary: summaryText,
    sources: sources.slice(0, 3),
    guardrail_status: "ok"
    // No options - sources have the links; avoids "Open document" + links duplication
  };
}

function extractYear(query: string): string | null {
  const match = query.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}
