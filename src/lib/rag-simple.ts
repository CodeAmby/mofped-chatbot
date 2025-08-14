import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

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
    console.log(`[search] Query: "${query}"`);
    
      // Since we don't have embeddings, focus on keyword search
  // Split query into words for better matching
  const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
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
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
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
      .or(`excerpt.ilike.%${query}%,keywords.cs.{${query}}`)
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
    return finalResults;

  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export function generateResponse(query: string, documents: DocumentResult[]): {
  summary: string;
  sources: Array<{ title: string; url: string; category: string | null }>;
  guardrail_status: string;
  options?: Array<{ text: string; action: string; query: string }>;
} {
  // Check for specific query types
  const queryLower = query.toLowerCase();
  const isContactQuery = queryLower.includes('contact') || queryLower.includes('phone') || queryLower.includes('email') || queryLower.includes('number') || queryLower.includes('support');
  const isIFMSQuery = queryLower.includes('ifms');
  const isEGPQuery = queryLower.includes('egp') || queryLower.includes('procurement');
  const isBudgetQuery = queryLower.includes('budget');
  const isURAQuery = queryLower.includes('ura') || queryLower.includes('revenue') || queryLower.includes('tax');
  const isBOUQuery = queryLower.includes('bou') || queryLower.includes('bank of uganda') || queryLower.includes('central bank');
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
    const egpPolicy = documents.find(doc => doc.title.toLowerCase().includes('procurement') && doc.category === 'Policies');
    
    if (egpSystem) {
      const options = [];
      if (egpContact) options.push({ text: "Talk to someone", action: "contact", query: "EGP contact" });
      if (egpPolicy) options.push({ text: "View procurement policy", action: "document", query: "procurement policy" });
      options.push({ text: "Visit EGP portal", action: "external", query: "https://egpuganda.go.ug/" });
      
      return {
        summary: `I found information about the **Electronic Government Procurement (EGP) Portal**. What would you like to know?\n\n• **Website**: Access the EGP portal for procurement processes\n• **Contact**: Get support contact information\n• **Policy**: View procurement guidelines and policies`,
        sources: [{
          title: egpSystem.title,
          url: egpSystem.url,
          category: egpSystem.category
        }],
        guardrail_status: "ok",
        options
      };
    }
  }

  if (isBudgetQuery && !isContactQuery) {
    const budgetPortal = documents.find(doc => doc.title.toLowerCase().includes('budget portal') && doc.category === 'External Systems');
    const budgetDocs = documents.filter(doc => doc.category === 'Budget');
    
    if (budgetPortal) {
      const options = [];
      if (budgetDocs.length > 0) options.push({ text: "View budget documents", action: "documents", query: "budget documents" });
      options.push({ text: "Visit budget portal", action: "external", query: "budget portal" });
      
      return {
        summary: `I found information about **Budget** resources. What would you like to access?\n\n• **Budget Portal**: Comprehensive budget information and reports\n• **Budget Documents**: Official budget papers and speeches\n• **Budget Reports**: Implementation and execution reports`,
        sources: [{
          title: budgetPortal.title,
          url: budgetPortal.url,
          category: budgetPortal.category
        }],
        guardrail_status: "ok",
        options
      };
    }
  }

  if (isIFMSQuery && !isContactQuery) {
    const ifmsContact = documents.find(doc => doc.title.toLowerCase().includes('ifms') && doc.category === 'Contact Information');
    
    if (ifmsContact) {
      return {
        summary: `I found information about the **Integrated Financial Management System (IFMS)**. What would you like to know?\n\n• **Contact Support**: Get technical support and access assistance\n• **System Information**: Learn about IFMS features and capabilities`,
        sources: [{
          title: ifmsContact.title,
          url: ifmsContact.url,
          category: ifmsContact.category
        }],
        guardrail_status: "ok",
        options: [
          { text: "Contact IFMS support", action: "contact", query: "IFMS contact" },
          { text: "Learn about IFMS", action: "info", query: "IFMS system" },
          { text: "IFMS Registration/Access e-registration services", action: "external", query: "https://ereg.ifms.go.ug/menu.php?page=menu" }
        ]
      };
    }
  }

  if (isURAQuery && !isContactQuery) {
    const uraSystem = documents.find(doc => doc.title.toLowerCase().includes('ura') && doc.category === 'External Systems');
    
    if (uraSystem) {
      return {
        summary: `I found information about the **Uganda Revenue Authority (URA)**. What would you like to access?\n\n• **URA Website**: Tax information, customs, and revenue collection\n• **Tax Services**: Filing, payments, and compliance`,
        sources: [{
          title: uraSystem.title,
          url: uraSystem.url,
          category: uraSystem.category
        }],
        guardrail_status: "ok",
        options: [
          { text: "Visit URA website", action: "external", query: "URA website" },
          { text: "Tax information", action: "info", query: "tax services" }
        ]
      };
    }
  }

  if (isPBSQuery && !isContactQuery) {
    return {
      summary: `I found information about the **Programme Based System (PBS)**. What would you like to access?\n\n• **PBS Portal**: Programme-based budgeting and financial management\n• **System Access**: Login to PBS portal for authorized users`,
      sources: [{
        title: "Programme Based System (PBS)",
        url: "https://pbsmof.finance.go.ug/auth/login",
        category: "External Systems"
      }],
      guardrail_status: "ok",
      options: [
        { text: "Access PBS Portal", action: "external", query: "https://pbsmof.finance.go.ug/auth/login" },
        { text: "Learn about PBS", action: "info", query: "programme based system" }
      ]
    };
  }

  if (isCFPQuery && !isContactQuery) {
    return {
      summary: `I found information about the **Climate Finance Platform (CFP)**. What would you like to access?\n\n• **CFP Portal**: Climate finance tracking and management\n• **User Access**: Login to CFP portal for authorized users`,
      sources: [{
        title: "Climate Finance Platform (CFP)",
        url: "https://climate.finance.go.ug/user/login",
        category: "External Systems"
      }],
      guardrail_status: "ok",
      options: [
        { text: "Access CFP Portal", action: "external", query: "https://climate.finance.go.ug/user/login" },
        { text: "Learn about CFP", action: "info", query: "climate finance platform" }
      ]
    };
  }

  // Generate general summary with options
  const categories = Object.keys(byCategory);
  let summary = `I found ${documents.length} relevant document${documents.length > 1 ? 's' : ''} on finance.go.ug:`;

  if (categories.length === 1) {
    summary += `\n\nAll documents are in the "${categories[0]}" category.`;
  } else {
    summary += `\n\nDocuments are categorized as: ${categories.join(', ')}.`;
  }

  // Add specific document mentions for top results
  const topDocs = documents.slice(0, 3);
  if (topDocs.length > 0) {
    summary += '\n\nKey documents include:';
    topDocs.forEach((doc, i) => {
      summary += `\n• ${doc.title}`;
      if (doc.description) {
        summary += ` - ${doc.description.substring(0, 100)}...`;
      }
    });
  }

  summary += '\n\nClick on the links below to view the full documents.';

  return {
    summary,
    sources: documents.map(doc => ({
      title: doc.title,
      url: doc.url,
      category: doc.category
    })),
    guardrail_status: "ok"
  };
}
