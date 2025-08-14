import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from "crypto";

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Sample MoFPED documents with metadata
const sampleDocuments = [
  {
    title: "FY 2024/25 Budget Framework Paper",
    url: "https://finance.go.ug/reports/fy-202425-budget-framework-paper",
    description: "Comprehensive overview of the national budget priorities, allocations, and fiscal framework for the 2024/25 financial year.",
    category: "Budget",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-06-15"
  },
  {
    title: "Budget Speech 2024",
    url: "https://finance.go.ug/reports/budget-speech-2024",
    description: "Minister's presentation of the 2024/25 budget to Parliament, outlining key fiscal policies and allocations.",
    category: "Budget",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-06-14"
  },
  {
    title: "Public Financial Management (PFM) Reforms Strategy",
    url: "https://finance.go.ug/policies/pfm-reforms-strategy",
    description: "Strategic framework for improving public financial management systems and accountability in Uganda.",
    category: "Policies",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-05-20"
  },
  {
    title: "Annual Report on Government Contingent Liabilities FY 2023/24",
    url: "https://finance.go.ug/reports/annual-report-government-uganda-contingent-liabilities-fy-202324",
    description: "Comprehensive report on government guarantees, commitments, and contingent liabilities for the 2023/24 financial year.",
    category: "Reports",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-04-30"
  },
  {
    title: "MOFPED Times Issue 19",
    url: "https://finance.go.ug/news/mofped-times-issue-19",
    description: "Latest newsletter covering ministry activities, policy updates, and key developments in public finance.",
    category: "News",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-07-01"
  },
  {
    title: "Tax Expenditure Governance Framework",
    url: "https://finance.go.ug/reports/governance-framework-tax-expenditures-government-uganda",
    description: "Framework for managing and monitoring tax expenditures to ensure fiscal transparency and accountability.",
    category: "Policies",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-03-15"
  },
  {
    title: "Budget Implementation Report Q1 2024",
    url: "https://finance.go.ug/reports/budget-implementation-report-q1-2024",
    description: "Quarterly report on budget execution, revenue collection, and expenditure performance for Q1 2024.",
    category: "Reports",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-10-15"
  },
  {
    title: "Medium Term Debt Strategy 2024-2028",
    url: "https://finance.go.ug/policies/medium-term-debt-strategy-2024-2028",
    description: "Strategic framework for managing public debt sustainably while supporting development objectives.",
    category: "Policies",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-02-28"
  }
];

// Sample excerpts for each document
const sampleExcerpts = {
  "Budget": [
    "The FY 2024/25 budget prioritizes infrastructure development, human capital investment, and economic transformation.",
    "Total budget allocation for FY 2024/25 is UGX 72.1 trillion, representing 18.5% of GDP.",
    "Key budget priorities include agriculture modernization, industrialization, and service delivery improvement."
  ],
  "Policies": [
    "The PFM reforms strategy aims to enhance transparency, accountability, and efficiency in public financial management.",
    "Tax expenditure governance framework ensures proper oversight of tax incentives and exemptions.",
    "Medium-term debt strategy focuses on sustainable borrowing while maintaining debt sustainability."
  ],
  "Reports": [
    "Budget implementation report shows 85% execution rate for Q1 2024, with strong revenue performance.",
    "Contingent liabilities report identifies government guarantees totaling UGX 8.2 trillion as of March 2024.",
    "Annual reports provide comprehensive analysis of fiscal performance and policy implementation."
  ],
  "News": [
    "MOFPED Times newsletter highlights key ministry achievements and policy developments.",
    "Latest issue covers budget preparation, international partnerships, and capacity building initiatives.",
    "News updates provide timely information on fiscal policy changes and economic developments."
  ]
};

async function populateSampleDataNoEmbeddings() {
  console.log('🔄 Populating database with sample MoFPED documents (no embeddings)...\n');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await supabase.from('DocumentExcerpt').delete().neq('id', '');
  await supabase.from('Document').delete().neq('id', '');

  let documentsCreated = 0;
  let excerptsCreated = 0;

  for (const doc of sampleDocuments) {
    try {
      console.log(`📄 Creating document: ${doc.title}`);

      // Insert document
      const { data: document, error: docError } = await supabase
        .from('Document')
        .insert({
          id: crypto.randomUUID(),
          title: doc.title,
          url: doc.url,
          description: doc.description,
          category: doc.category,
          contentType: doc.contentType,
          source: doc.source,
          publishDate: doc.publishDate,
          isActive: true,
          hash: crypto.randomUUID(), // Temporary hash
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (docError) {
        console.error(`❌ Error creating document:`, docError);
        continue;
      }

      documentsCreated++;

      // Create excerpts for this document (without embeddings)
      const excerpts = sampleExcerpts[doc.category] || [
        `Key information about ${doc.title.toLowerCase()}.`,
        `Important details and policy implications.`,
        `Summary of main points and recommendations.`
      ];

      for (let i = 0; i < excerpts.length; i++) {
        const excerpt = excerpts[i];
        console.log(`  📝 Creating excerpt ${i + 1}/${excerpts.length} (no embedding)`);

        // Insert excerpt without embedding
        const { error: excerptError } = await supabase
          .from('DocumentExcerpt')
          .insert({
            id: crypto.randomUUID(),
            documentId: document.id,
            excerpt,
            keywords: [doc.category.toLowerCase(), ...excerpt.toLowerCase().split(' ').slice(0, 5)],
            embedding: null, // No embedding for now
            relevance: 1.0 - (i * 0.1) // First excerpt is most relevant
          });

        if (excerptError) {
          console.error(`❌ Error creating excerpt:`, excerptError);
        } else {
          excerptsCreated++;
        }
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error processing document:`, error);
    }
  }

  console.log(`\n🎉 Sample data population complete!`);
  console.log(`  ✅ Documents created: ${documentsCreated}`);
  console.log(`  ✅ Excerpts created: ${excerptsCreated}`);
  console.log(`\n📊 Database now contains sample MoFPED documents ready for testing.`);
  console.log(`⚠️  Note: Excerpts were created without embeddings due to API quota limits.`);
  console.log(`   Semantic search will fall back to keyword matching.`);
}

populateSampleDataNoEmbeddings().catch(console.error);
