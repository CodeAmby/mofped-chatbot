export type IntentType = 'location' | 'document' | 'contact' | 'service';

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  keywords: string[];
}

export function classifyIntent(query: string): IntentClassification {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);
  
  // Location/Directions keywords
  const locationKeywords = [
    'where', 'address', 'location', 'directions', 'map', 'office', 'premises', 
    'plot', 'headquarters', 'visit', 'physical', 'building', 'street', 'road',
    'how do i get there', 'located', 'situated', 'find', 'place'
  ];
  
  // Document/Policy keywords
  const documentKeywords = [
    'show', 'download', 'form', 'circular', 'policy', 'document', 'paper',
    'budget framework', 'nbfp', 'pfma', 'section', 'regulation', 'guideline',
    'manual', 'procedure', 'template', 'application form', 'report'
  ];
  
  // Contact/Hotlines keywords
  const contactKeywords = [
    'phone', 'number', 'email', 'contact', 'help desk', 'support', 'hotline',
    'call', 'reach', 'speak to', 'talk to', 'assistance', 'help', 'inquiry'
  ];
  
  // Service How-To keywords
  const serviceKeywords = [
    'how to', 'apply', 'requirements', 'process', 'procedure', 'steps',
    'application', 'registration', 'submit', 'apply for', 'get', 'obtain',
    'processing time', 'duration', 'timeline', 'deadline', 'when', 'schedule'
  ];
  
  // Count matches for each intent
  const locationScore = words.filter(word => 
    locationKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
  ).length;
  
  const documentScore = words.filter(word => 
    documentKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
  ).length;
  
  const contactScore = words.filter(word => 
    contactKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
  ).length;
  
  const serviceScore = words.filter(word => 
    serviceKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
  ).length;
  
  // Special cases and overrides
  if (lowerQuery.includes('where is') || (lowerQuery.includes('address') && !lowerQuery.includes('email'))) {
    return {
      intent: 'location',
      confidence: 0.95,
      keywords: words.filter(word => locationKeywords.some(keyword => word.includes(keyword) || keyword.includes(word)))
    };
  }
  
  if (lowerQuery.includes('phone') || lowerQuery.includes('email') || lowerQuery.includes('contact')) {
    return {
      intent: 'contact',
      confidence: 0.9,
      keywords: words.filter(word => contactKeywords.some(keyword => word.includes(keyword) || keyword.includes(word)))
    };
  }
  
  if (lowerQuery.includes('find') && (lowerQuery.includes('document') || lowerQuery.includes('policy') || lowerQuery.includes('form'))) {
    return {
      intent: 'document',
      confidence: 0.9,
      keywords: words.filter(word => documentKeywords.some(keyword => word.includes(keyword) || keyword.includes(word)))
    };
  }
  
  if (lowerQuery.includes('how to') || lowerQuery.includes('apply for') || lowerQuery.includes('requirements')) {
    return {
      intent: 'service',
      confidence: 0.85,
      keywords: words.filter(word => serviceKeywords.some(keyword => word.includes(keyword) || keyword.includes(word)))
    };
  }
  
  if (lowerQuery.includes('download') || lowerQuery.includes('form') || lowerQuery.includes('circular')) {
    return {
      intent: 'document',
      confidence: 0.9,
      keywords: words.filter(word => documentKeywords.some(keyword => word.includes(keyword) || keyword.includes(word)))
    };
  }
  
  // Determine intent based on highest score
  const scores = [
    { intent: 'location' as IntentType, score: locationScore },
    { intent: 'document' as IntentType, score: documentScore },
    { intent: 'contact' as IntentType, score: contactScore },
    { intent: 'service' as IntentType, score: serviceScore }
  ];
  
  const maxScore = Math.max(...scores.map(s => s.score));
  const bestIntent = scores.find(s => s.score === maxScore);
  
  if (!bestIntent || maxScore === 0) {
    // Default to document lookup if no clear intent
    return {
      intent: 'document',
      confidence: 0.3,
      keywords: []
    };
  }
  
  const confidence = Math.min(0.9, 0.3 + (maxScore * 0.2));
  
  return {
    intent: bestIntent.intent,
    confidence,
    keywords: words.filter(word => {
      const allKeywords = [...locationKeywords, ...documentKeywords, ...contactKeywords, ...serviceKeywords];
      return allKeywords.some(keyword => word.includes(keyword) || keyword.includes(word));
    })
  };
}
