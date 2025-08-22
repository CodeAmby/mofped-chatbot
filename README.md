# MoFPED Chatbot

A modern Retrieval-Augmented Generation (RAG) chatbot for the Ministry of Finance, Planning and Economic Development (MoFPED) website. This chatbot provides intelligent answers to public queries using content from finance.go.ug and approved sub-domains.

## Features

- **Intent-Based Routing**: Intelligent classification of user queries into four categories:
  - 📍 **Location/Directions** - Office addresses and directions
  - 📞 **Contact Information** - Phone numbers, emails, and support details
  - 🔧 **Service How-To** - Application processes and requirements
  - 📄 **Document Lookup** - Policies, forms, and official documents
- **Source Priority System**: 
  - Primary: Official finance.go.ug website
  - Secondary: Government directories (gov.ug)
  - Tertiary: Internal document database (RAG)
- **Web Scraping**: Real-time information from official government websites
- **Modern Chat Interface**: Responsive, MoFPED-branded chatbot widget
- **Document Discovery**: Intelligent search and categorization of MoFPED documents
- **Supabase Integration**: Vector search with pgvector for semantic matching
- **Metadata-Based Search**: Focus on document titles, descriptions, and categories
- **Source Linking**: Direct links to authoritative source documents
- **Zero Hallucination**: No content generation, only document discovery and linking

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + pgvector)
- **AI/ML**: OpenAI GPT-4 Turbo, text-embedding-3-small
- **RAG**: LangChain 0.3.30, custom hybrid search
- **Database**: Supabase with pgvector extension
- **Styling**: Lucide React icons, custom MoFPED branding

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account with pgvector enabled
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mofped-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file with:
   ```env
   DATABASE_URL=your_supabase_connection_string
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Deployment

### Production Deployment

The chatbot is currently deployed on Vercel and available at:
**https://mofpedchatbot.vercel.app**

### Environment Variables

The following environment variables are configured in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### Embedding the Widget

To embed the chatbot on your website, add this script:

```html
<script src="https://mofpedchatbot.vercel.app/embed.js" async></script>
```

Or customize the widget:

```html
<script>
  window.MoFPEDChatbot = {
    apiUrl: 'https://mofpedchatbot.vercel.app/api/ask',
    primaryColor: '#0B1F3B',
    secondaryColor: '#1E40AF'
  };
</script>
<script src="https://mofpedchatbot.vercel.app/embed.js" async></script>
```

## Intent Routing System

The MoFPED Help Assistant uses an intelligent intent classification system to route user queries to the most appropriate information source:

### Location/Directions Queries
- **Keywords**: "where is", "address", "location", "directions", "office", "premises"
- **Response**: Official address from finance.go.ug, office hours, contact info, and Google Maps link
- **Format**: Structured response with address, hours, phone/email, and directions link

### Contact/Hotlines Queries  
- **Keywords**: "phone", "email", "contact", "help desk", "support"
- **Response**: Official contact information from finance.go.ug contact pages
- **Format**: Department-specific contact details with phone numbers and email addresses

### Service How-To Queries
- **Keywords**: "how to", "apply", "requirements", "process", "procedure"
- **Response**: Service information from official government service pages
- **Fallback**: RAG search through internal service documents

### Document/Policy Queries
- **Keywords**: "download", "form", "circular", "policy", "document"
- **Response**: RAG search through internal document database
- **Format**: Document links with descriptions and categories

## Available Scripts

- `npm run dev` - Start development server
- `npm run test-intent` - Test the intent classification system
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run smoke` - Test Supabase connection
- `npm run populate-sample` - Add sample MoFPED documents to database
- `npm run check-db` - Check database state and document counts

## Project Structure

```
mofped-chatbot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ask/          # RAG API endpoint
│   │   │   └── chat/         # Legacy chat endpoint
│   │   ├── globals.css       # Global styles
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Main chatbot UI
│   ├── lib/
│   │   ├── prisma.ts         # Prisma client (legacy)
│   │   ├── rag.ts            # Legacy RAG service
│   │   └── rag-supabase.ts   # Supabase RAG service
│   └── types/                # TypeScript type definitions
├── scripts/
│   ├── ingest.ts             # Legacy ingestion script
│   ├── ingest-supabase.ts    # Supabase ingestion script
│   ├── test-doc.ts           # Test document script
│   └── doc-smoke.mjs         # Connection test script
├── prisma/
│   └── schema.prisma         # Database schema
└── public/                   # Static assets
```

## Database Schema

The project uses a PostgreSQL database with the following key tables:

- **Document**: Document metadata (title, URL, description, category)
- **DocumentExcerpt**: Key excerpts with vector embeddings for semantic search
- **ChatSession**: Chat session tracking
- **ChatMessage**: Individual chat messages with document references

## Current Status

✅ **Completed:**
- Modern chatbot UI with MoFPED branding and finance.go.ug homepage simulation
- Supabase integration with all environment variables configured
- Conversational RAG API with document discovery and external linking
- Database schema optimized for metadata search
- Sample data population with comprehensive MoFPED documents
- Production deployment on Vercel
- Embeddable widget for external websites
- Analytics integration with Vercel Analytics

✅ **Live Demo:**
- **Production URL**: https://mofpedchatbot.vercel.app
- **API Endpoint**: https://mofpedchatbot.vercel.app/api/ask
- **Widget Embed**: Available at `/embed.js`

🔄 **Features Working:**
- IFMS queries with external links to e-registration services
- EGP queries with portal access
- PBS and CFP system information
- Contact information and support details
- Conversational options and clickable responses
- Real-time document search and discovery

⏳ **Next Steps:**
- Populate with additional real MoFPED documents
- Implement advanced filtering by category/date
- Add comprehensive analytics dashboard
- Custom domain setup (optional)
- Performance optimization and caching

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
