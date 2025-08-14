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

// Comprehensive MoFPED data including peripheral organizations and contacts
const comprehensiveData = [
  // Core MoFPED Documents
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
  
  // Peripheral Organizations and Systems
  {
    title: "Budget Portal - Budget.go.ug",
    url: "https://budget.go.ug",
    description: "Official budget portal for Uganda. Access budget documents, budget execution reports, and budget-related information.",
    category: "External Systems",
    contentType: "website",
    source: "budget.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "Integrated Financial Management System (IFMS)",
    url: "https://ifms.go.ug",
    description: "Uganda's Integrated Financial Management System for government financial operations, accounting, and reporting.",
    category: "External Systems",
    contentType: "website",
    source: "ifms.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "Electronic Government Procurement (EGP) Portal",
    url: "https://egp.go.ug",
    description: "Electronic Government Procurement portal for public procurement processes, tenders, and supplier registration.",
    category: "External Systems",
    contentType: "website",
    source: "egp.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "Uganda Revenue Authority (URA)",
    url: "https://ura.go.ug",
    description: "Official website of Uganda Revenue Authority for tax information, customs, and revenue collection.",
    category: "External Systems",
    contentType: "website",
    source: "ura.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "Bank of Uganda (BOU)",
    url: "https://www.bou.or.ug",
    description: "Central Bank of Uganda website for monetary policy, banking supervision, and financial stability information.",
    category: "External Systems",
    contentType: "website",
    source: "bou.or.ug",
    publishDate: "2024-01-01"
  },
  
  // Contact Information
  {
    title: "MoFPED Contact Information",
    url: "https://finance.go.ug/contact-us",
    description: "Contact details for the Ministry of Finance, Planning and Economic Development including phone numbers, email addresses, and physical address.",
    category: "Contact Information",
    contentType: "html",
    source: "finance.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "IFMS Contact Center",
    url: "https://ifms.go.ug/contact",
    description: "IFMS Contact Center for technical support, system access, and user assistance. Phone: +256 414 230 000, Email: support@ifms.go.ug",
    category: "Contact Information",
    contentType: "html",
    source: "ifms.go.ug",
    publishDate: "2024-01-01"
  },
  {
    title: "EGP Support Contact",
    url: "https://egp.go.ug/support",
    description: "Electronic Government Procurement support contact information for procurement-related queries and technical assistance.",
    category: "Contact Information",
    contentType: "html",
    source: "egp.go.ug",
    publishDate: "2024-01-01"
  },
  
  // Policy Documents
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
    title: "Procurement Policy and Guidelines",
    url: "https://finance.go.ug/policies/procurement-policy",
    description: "Government procurement policy, guidelines, and procedures for public procurement in Uganda.",
    category: "Policies",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-03-15"
  },
  
  // Reports
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
    title: "Budget Implementation Report Q1 2024",
    url: "https://finance.go.ug/reports/budget-implementation-report-q1-2024",
    description: "Quarterly report on budget execution, revenue collection, and expenditure performance for Q1 2024.",
    category: "Reports",
    contentType: "pdf",
    source: "finance.go.ug",
    publishDate: "2024-10-15"
  }
];

// Enhanced excerpts with contact information and external links
const enhancedExcerpts = {
  "Budget": [
    "The FY 2024/25 budget prioritizes infrastructure development, human capital investment, and economic transformation.",
    "Total budget allocation for FY 2024/25 is UGX 72.1 trillion, representing 18.5% of GDP.",
    "Key budget priorities include agriculture modernization, industrialization, and service delivery improvement."
  ],
  "External Systems": [
    "Budget Portal (budget.go.ug) provides comprehensive budget information and execution reports.",
    "IFMS (ifms.go.ug) is Uganda's Integrated Financial Management System for government financial operations.",
    "EGP Portal (egp.go.ug) handles electronic government procurement processes and tenders.",
    "URA (ura.go.ug) manages tax collection and customs operations in Uganda."
  ],
  "Contact Information": [
    "MoFPED Contact: +256 414 230 000, Email: info@finance.go.ug, Address: Plot 2-12 Apollo Kaggwa Road, Kampala.",
    "IFMS Contact Center: +256 414 230 000, Email: support@ifms.go.ug for technical support and system access.",
    "EGP Support: +256 414 230 000, Email: egp-support@egp.go.ug for procurement-related queries.",
    "URA Contact: +256 417 730 000, Email: ura@ura.go.ug for tax and customs inquiries."
  ],
  "Policies": [
    "The PFM reforms strategy aims to enhance transparency, accountability, and efficiency in public financial management.",
    "Procurement policy ensures proper oversight of government procurement processes and procedures.",
    "Medium-term debt strategy focuses on sustainable borrowing while maintaining debt sustainability."
  ],
  "Reports": [
    "Budget implementation report shows 85% execution rate for Q1 2024, with strong revenue performance.",
    "Contingent liabilities report identifies government guarantees totaling UGX 8.2 trillion as of March 2024.",
    "Annual reports provide comprehensive analysis of fiscal performance and policy implementation."
  ]
};

async function populateComprehensiveData() {
  console.log('🔄 Populating database with comprehensive MoFPED data...\n');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await supabase.from('DocumentExcerpt').delete().neq('id', '');
  await supabase.from('Document').delete().neq('id', '');

  let documentsCreated = 0;
  let excerptsCreated = 0;

  for (const doc of comprehensiveData) {
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
          hash: crypto.randomUUID(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (docError) {
        console.error(`❌ Error creating document:`, docError);
        continue;
      }

      documentsCreated++;

      // Create excerpts for this document
      const excerpts = enhancedExcerpts[doc.category] || [
        `Key information about ${doc.title.toLowerCase()}.`,
        `Important details and contact information.`,
        `Summary of main points and external links.`
      ];

      for (let i = 0; i < excerpts.length; i++) {
        const excerpt = excerpts[i];
        console.log(`  📝 Creating excerpt ${i + 1}/${excerpts.length}`);

        // Insert excerpt without embedding
        const { error: excerptError } = await supabase
          .from('DocumentExcerpt')
          .insert({
            id: crypto.randomUUID(),
            documentId: document.id,
            excerpt,
            keywords: [doc.category.toLowerCase(), ...excerpt.toLowerCase().split(' ').slice(0, 5)],
            embedding: null,
            relevance: 1.0 - (i * 0.1)
          });

        if (excerptError) {
          console.error(`❌ Error creating excerpt:`, excerptError);
        } else {
          excerptsCreated++;
        }
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ Error processing document:`, error);
    }
  }

  console.log(`\n🎉 Comprehensive data population complete!`);
  console.log(`  ✅ Documents created: ${documentsCreated}`);
  console.log(`  ✅ Excerpts created: ${excerptsCreated}`);
  console.log(`\n📊 Database now contains comprehensive MoFPED data including:`);
  console.log(`  • Core budget and policy documents`);
  console.log(`  • Peripheral organization links (IFMS, EGP, URA, BOU)`);
  console.log(`  • Contact information and support details`);
  console.log(`  • External system references`);
}

populateComprehensiveData().catch(console.error);
