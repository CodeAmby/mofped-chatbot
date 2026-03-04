import * as cheerio from 'cheerio';

export interface LocationInfo {
  address: string;
  hours?: string;
  phone?: string;
  email?: string;
  lastChecked: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  department?: string;
  hours?: string;
}

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
  lastChecked: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export async function scrapeFinanceGoUg(url: string): Promise<ScrapedContent | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoFPED-Help-Assistant/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': 'https://www.finance.go.ug/',
        'Origin': 'https://www.finance.go.ug',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style').remove();
    
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    
    return {
      title,
      content,
      url,
      lastChecked: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

export async function searchFinanceGoUg(query: string, limit = 5): Promise<SearchResult[]> {
  const queries = buildSearchQueries(query);
  const keywords = extractSearchKeywords(query);

  for (const q of queries) {
    const results = await searchFinanceGoUgOnce(q, limit);
    const filtered = filterResultsByKeywords(results, keywords);
    if (filtered.length > 0) {
      return filtered.slice(0, limit);
    }
  }

  return [];
}

async function searchFinanceGoUgOnce(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const searchUrl = `https://www.finance.go.ug/search/node?keys=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoFPED-Help-Assistant/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': 'https://www.finance.go.ug/',
        'Origin': 'https://www.finance.go.ug',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch search results: ${response.status}`);
      return [];
    }

    const html = await response.text();
    if (html.includes('Your search yielded no results')) {
      return [];
    }

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    const collectFromElements = (elements: cheerio.Cheerio) => {
      elements.each((_, el) => {
        const element = $(el);
        const link =
          element.find('h3 a').first() ||
          element.find('.views-field-title a').first() ||
          element.find('a').first();

        const title = link.text().trim();
        let url = link.attr('href') || '';

        if (!title || !url) {
          return;
        }

        if (url.startsWith('/')) {
          url = `https://www.finance.go.ug${url}`;
        }

        const snippet =
          element.find('.search-result__snippet').first().text().trim() ||
          element.find('.views-field-body').first().text().trim() ||
          element.text().replace(/\s+/g, ' ').trim();

        results.push({ title, url, snippet });
      });
    };

    const containerSelectors = [
      '.view-search .views-row',
      'ol.search-results li'
    ];

    for (const selector of containerSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        collectFromElements(elements);
        break;
      }
    }

    if (results.length === 0) {
      const headingLinks = $('h2 a, h3 a').toArray();
      headingLinks.forEach((linkEl) => {
        const link = $(linkEl);
        const title = link.text().trim();
        let url = link.attr('href') || '';
        if (!title || !url) {
          return;
        }
        if (url.startsWith('/')) {
          url = `https://www.finance.go.ug${url}`;
        }
        if (!url.includes('finance.go.ug')) {
          return;
        }
        const container =
          link.closest('article').length > 0
            ? link.closest('article')
            : link.closest('div');
        const snippet = container.text().replace(/\s+/g, ' ').trim();
        results.push({ title, url, snippet });
      });
    }

    const deduped = new Map<string, SearchResult>();
    results.forEach((result) => {
      if (!deduped.has(result.url)) {
        deduped.set(result.url, result);
      }
    });

    return Array.from(deduped.values()).slice(0, limit);
  } catch (error) {
    console.error('Error searching finance.go.ug:', error);
    return [];
  }
}

function filterResultsByKeywords(results: SearchResult[], keywords: string[]): SearchResult[] {
  const keywordsWithoutYear = keywords.filter((keyword) => !/^(19|20)\d{2}$/.test(keyword));
  if (keywordsWithoutYear.length === 0) {
    return results;
  }

  const minimumMatches = Math.max(1, Math.min(2, keywordsWithoutYear.length));
  return results.filter((result) => {
    const haystack = `${result.title} ${result.url}`.toLowerCase();
    const matchCount = keywordsWithoutYear.reduce((count, keyword) => {
      if (haystack.includes(keyword)) {
        return count + 1;
      }
      return count;
    }, 0);
    return matchCount >= minimumMatches;
  });
}

function extractSearchKeywords(query: string): string[] {
  const stopwords = new Set([
    'please',
    'give',
    'me',
    'show',
    'find',
    'need',
    'want',
    'the',
    'a',
    'an',
    'for',
    'to',
    'of',
    'about',
    'and',
    'year',
    'document',
    'documents'
  ]);

  const cleaned = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keywords = cleaned
    .split(' ')
    .filter((word) => word.length > 3 && !stopwords.has(word))
    .map((word) => {
      if (word === 'papers') return 'paper';
      if (word === 'docs' || word === 'doc') return 'document';
      return word;
    });

  const unique = Array.from(new Set(keywords));
  if (unique.includes('budget') && unique.includes('call')) {
    unique.push('circular');
    unique.push('bcc');
  }

  return Array.from(new Set(unique));
}

function buildSearchQueries(query: string): string[] {
  const cleaned = query
    .replace(/\b(docs|doc)\b/gi, 'document')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned.toLowerCase();
  const queries = new Set<string>();

  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  const withoutYear = cleaned.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
  const singular = withoutYear.replace(/\bpapers\b/g, 'paper').trim();

  queries.add(cleaned);
  if (withoutYear && withoutYear !== cleaned) {
    queries.add(withoutYear);
  }
  if (singular && singular !== withoutYear) {
    queries.add(singular);
  }

  if (base.includes('budget call')) {
    queries.add('budget call circular');
    queries.add('budget call paper');
    queries.add('budget call');
    if (year) {
      queries.add(`budget call circular ${year}`);
      queries.add(`budget call paper ${year}`);
      queries.add(`budget call ${year}`);
    }
  }

  if (base.includes('budget paper')) {
    queries.add('budget framework paper');
    queries.add('budget framework');
    if (year) {
      queries.add(`budget framework paper ${year}`);
      queries.add(`budget framework ${year}`);
    }
  }

  if (base.includes('budget')) {
    queries.add('budget');
    queries.add('budget document');
    queries.add('budget documents');
    if (year) {
      queries.add(`budget ${year}`);
      queries.add(`budget document ${year}`);
      queries.add(`budget documents ${year}`);
    }
  }

  return Array.from(queries).filter(Boolean);
}

export async function getMoFPEDLocation(): Promise<LocationInfo | null> {
  try {
    // Try to get location info from finance.go.ug contact/about pages
    const urls = [
      'https://www.finance.go.ug/contact-us',
      'https://www.finance.go.ug/about-us',
      'https://www.finance.go.ug/contact',
      'https://www.finance.go.ug'
    ];

    for (const url of urls) {
      const scraped = await scrapeFinanceGoUg(url);
      if (scraped) {
        const locationInfo = extractLocationFromContent(scraped.content, scraped.title);
        if (locationInfo && locationInfo.address) {
          return {
            ...locationInfo,
            lastChecked: scraped.lastChecked
          };
        }
      }
    }

    // Fallback to known official address
    return {
      address: "Ministry of Finance, Planning and Economic Development, Plot 2-12 Apollo Kaggwa Road, P.O. Box 8147, Kampala, Uganda",
      hours: "Monday - Friday: 8:00 AM - 5:00 PM",
      phone: "+256 414 230 000",
      email: "info@finance.go.ug",
      lastChecked: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Error getting MoFPED location:', error);
    return null;
  }
}

export async function getMoFPEDContacts(): Promise<ContactInfo[]> {
  try {
    const scraped = await scrapeFinanceGoUg('https://www.finance.go.ug/contact-us');
    if (scraped) {
      return extractContactsFromContent(scraped.content);
    }
    
    // Fallback contacts
    return [
      {
        phone: "+256 414 230 000",
        email: "info@finance.go.ug",
        department: "General Inquiries"
      },
      {
        phone: "+256 414 230 001",
        email: "ict@finance.go.ug",
        department: "ICT Support"
      }
    ];
  } catch (error) {
    console.error('Error getting MoFPED contacts:', error);
    return [];
  }
}

function extractLocationFromContent(content: string, title: string): Partial<LocationInfo> | null {
  const lowerContent = content.toLowerCase();
  
  // Look for address patterns
  const addressPatterns = [
    /plot\s+\d+[-\s]\d*\s+[^,]+,\s*[^,]+,\s*kampala/i,
    /apollo\s+kaggwa\s+road/i,
    /ministry\s+of\s+finance[^,]*,\s*[^,]+,\s*kampala/i,
    /p\.?o\.?\s*box\s+\d+[^,]*,\s*kampala/i
  ];
  
  for (const pattern of addressPatterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        address: match[0].trim()
      };
    }
  }
  
  // Look for phone numbers
  const phonePattern = /(\+256\s*\d{3}\s*\d{3}\s*\d{3}|\d{3}\s*\d{3}\s*\d{3})/g;
  const phoneMatch = content.match(phonePattern);
  
  // Look for email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatch = content.match(emailPattern);
  
  // Look for office hours
  const hoursPattern = /(monday|tuesday|wednesday|thursday|friday)[^.]*(?:am|pm)[^.]*(?:am|pm)/gi;
  const hoursMatch = content.match(hoursPattern);
  
  const result: Partial<LocationInfo> = {};
  
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\s+/g, ' ');
  }
  
  if (emailMatch) {
    result.email = emailMatch[0];
  }
  
  if (hoursMatch) {
    result.hours = hoursMatch[0];
  }
  
  return Object.keys(result).length > 0 ? result : null;
}

function extractContactsFromContent(content: string): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  
  // Look for phone numbers
  const phonePattern = /(\+256\s*\d{3}\s*\d{3}\s*\d{3}|\d{3}\s*\d{3}\s*\d{3})/g;
  const phoneMatches = content.matchAll(phonePattern);
  
  for (const match of phoneMatches) {
    contacts.push({
      phone: match[0].replace(/\s+/g, ' ')
    });
  }
  
  // Look for email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = content.matchAll(emailPattern);
  
  for (const match of emailMatches) {
    contacts.push({
      email: match[0]
    });
  }
  
  return contacts;
}

export function createMapsLink(address: string): string {
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}
