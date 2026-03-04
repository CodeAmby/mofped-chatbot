# MoFPED Chatbot – Deployment & Setup

## Current Status

- **Git**: Connected to `https://github.com/CodeAmby/mofped-chatbot.git` (pushed)
- **Vercel**: Deployed to `mofped-projects/mofped-chatbot` (Production: Ready)
- **Supabase**: Project ref `jvejsjqwgiufsttpdbki` – connected via Vercel integration.

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

1. **Dashboard**: [Supabase Project](https://supabase.com/dashboard/project/jvejsjqwgiufsttpdbki)
2. **Get credentials**: Project Settings → API (URL & anon key) and Database (connection string)
3. **Link locally** (optional):
   ```bash
   supabase link --project-ref jvejsjqwgiufsttpdbki
   ```
4. **Add to Vercel**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://[ref].supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase dashboard)
   - `DATABASE_URL` = Use **port 6543** (transaction pooler) with `?pgbouncer=true` for Prisma. Format: `postgresql://postgres.[ref]:[password]@aws-1-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`

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
| `supabase link --project-ref REF` | Link to Supabase project |

## Troubleshooting: Postgres connection timeout

If you see `dial tcp ...:5432: i/o timeout`:

1. **Use port 6543** – In Supabase Dashboard → Project Settings → Database, copy the **Connection string** → **URI** and ensure it uses port **6543** (transaction pooler), not 5432.
2. **Try a different region** – If `ap-southeast-1` times out, create a new project in **us-east-1** (Virginia) or **eu-west-1** (Ireland) for better connectivity.
3. **Check firewall** – Some networks block port 5432; 6543 is less often blocked.
