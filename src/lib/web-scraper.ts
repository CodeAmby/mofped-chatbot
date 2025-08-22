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
