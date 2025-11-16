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

Output will look like:

```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

➡️ Copy `database_id` into your `wrangler.toml`.

---

## 3. Create KV Namespace (for caching)

```bash
npx wrangler kv namespace create REALTIME_EDITOR_CACHE
```

Output:

```
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

➡️ Copy this KV `id` into your `wrangler.toml`.

---

## 4. Initialize the Database Schema

```bash
npx wrangler d1 execute collaborative_editor --file=./schema.sql
```

---

## 5. Development Mode

```bash
npm run dev
```

---

## 6. Deploy to Cloudflare

```bash
npm run deploy
```

---

## (Optional) Set Encryption Key

```bash
npx wrangler secret put ENCRYPTION_KEY
```
