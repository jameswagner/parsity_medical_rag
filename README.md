# Medical Data Explorer

A small read-only browser for the course's synthetic patient database (Synthea, zero real patients). Students keep it open next to their RAG app to check what the agent *should* have answered.

- **Find a patient** by name or id. Every patient page shows demographics, active medications (the `currentMedications` metadata), conditions, latest observations, medication history and every note, newest first.
- **Keyword search the notes**: an exact-text search to compare against semantic search ("short of breath" vs "dyspnea").
- **Pre-baked queries**, each showing its SQL: table sizes, patients with the most notes, shared first names (the Avery Mueller problem), the exact condition/medication/smoking strings, note types, demographics, random patients.

There is no free-form SQL box: the site is public, so every statement lives in `lib/`.

## Deploy on Vercel

1. Import this repo in Vercel (framework: Next.js, no build settings to change).
2. Add one environment variable: `DATABASE_URL` = the same **read-only** `student_ro` connection string students use. Use the pooled Neon host (`-pooler` in the hostname).
3. Deploy.

## Run locally

```bash
cp .env.example .env.local   # paste the read-only DATABASE_URL
npm install
npm run dev
```
