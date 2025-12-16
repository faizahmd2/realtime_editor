# Instant, Shareable Web Notes

A super-light web editor where you can open a page and start writing immediately.
Your notes stay linked to the page you opened, and anyone with the same link can see changes live.
Useful for quick thoughts, sharing text, or keeping simple notes across devices.

# Setup Guide

## 1. Clone the Repository  
(Must have a Cloudflare account)

```bash
git clone <repo-url>
cd <repo-folder>

npm install
npm install -D wrangler
npx wrangler login
````

---

## 2. Create a D1 Database

```bash
npx wrangler d1 create collaborative_editor
```
---

## 3. For caching Create KV Namespace

```bash
npx wrangler kv namespace create REALTIME_EDITOR_CACHE
```
---

## 4. Initialize the Database Schema

```bash
npx wrangler d1 execute collaborative_editor --file=./schema.sql
```

---

## 5. Run locally

```bash
npm run dev
```

---

## 6. Deploy to Cloudflare

```bash
npm run deploy
```
