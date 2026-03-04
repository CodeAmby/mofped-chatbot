# Stable Build Reference

**Last stable build:** March 2025

This document marks the build where the chatbot was fully working in production (Vercel).

## What was fixed in this build

- API route returns 400 for empty body → fixed with `req.text()` + robust body parsing
- Request body empty in production → fixed with `export const runtime = "nodejs"`
- CORS and deployment protection configured for production
- Response handling: always returns `response`/`summary` for consistent frontend display

## To tag this as stable (after committing)

```bash
git add .
git commit -m "Stable build: production fixes, natural greetings"
git tag -a v1.0-stable -m "Last known stable production build"
git push origin main --tags
```

## Rollback reference

If a future deploy breaks production, revert to this tag:

```bash
git checkout v1.0-stable
```
