# MoFPED Chatbot

A modern Retrieval-Augmented Generation (RAG) chatbot for the Ministry of Finance, Planning and Economic Development (MoFPED) website. This chatbot provides intelligent answers to public queries using content from finance.go.ug and approved sub-domains.

## Features

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

## Available Scripts

- `npm run dev` - Start development server
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
- Modern chatbot UI with MoFPED branding
- Supabase integration and connection testing
- Simplified document discovery API
- Database schema optimized for metadata search
- Sample data population framework

🔄 **In Progress:**
- Sample document population and testing
- Semantic search optimization
- Document categorization

⏳ **Next Steps:**
- Populate with real MoFPED documents
- Implement advanced filtering by category/date
- Add document analytics and usage tracking
- Create embeddable widget
- Deploy to production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
