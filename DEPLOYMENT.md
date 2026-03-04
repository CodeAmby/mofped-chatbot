# MoFPED Chatbot – Deployment & Setup

## Current Status

- **Git**: Connected to `https://github.com/CodeAmby/mofped-chatbot.git` (pushed)
- **Vercel**: Deployed to `mofped-projects/mofped-chatbot` (Production: Ready)
- **Supabase**: Project "Mofped Chatbot" exists but is **paused** – unpause in dashboard to use

**Production URL**: https://mofped-chatbot-mofped-projects.vercel.app (or check Vercel dashboard)

To enable auto-deploy on push: Vercel Dashboard → Settings → Git → Connect Repository → select `CodeAmby/mofped-chatbot`

---

## What You Need to Provide

### 1. OpenAI API Key (required for production chat)

The app uses OpenAI for AI responses. Without it, users see "AI service is not configured."

**Add to Vercel:**
1. Go to [Vercel Dashboard](https://vercel.com/mofped-projects/mofped-chatbot) → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-...` (your OpenAI API key)
   - **Environment**: Production, Preview, Development

### 2. Supabase (optional – for better document search)

If you want vector search over Supabase instead of only finance.go.ug fallback:

1. **Unpause** project: [Supabase Dashboard](https://supabase.com/dashboard/project/wxrhkqtzfxtjjgbnqcml) → Settings → Unpause
2. **Get credentials**: Project Settings → API (URL & anon key) and Database (connection string)
3. **Link locally** (optional):
   ```bash
   supabase link --project-ref wxrhkqtzfxtjjgbnqcml
   ```
4. **Add to Vercel**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://wxrhkqtzfxtjjgbnqcml.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase dashboard)
   - `DATABASE_URL` = (from Supabase dashboard, e.g. connection pooler URL)

### 3. Redeploy after adding env vars

After adding `OPENAI_API_KEY` (and optional Supabase vars):

```bash
vercel --prod
```

Or push to `main` – Vercel auto-deploys from GitHub if connected.

---

## Local Development

1. Copy `.env.example` to `.env.local`
2. Add your keys (see `.env.example` for structure)
3. For local AI: set `USE_LOCAL_AI=true` and run Ollama (see `LOCAL_AI_SETUP.md`)

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `vercel` | Deploy preview |
| `vercel --prod` | Deploy production |
| `supabase link` | Link to Supabase project (after unpause) |
