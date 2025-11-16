# Setup Guide

## 1. Clone the Repository  
(Must have a Cloudflare account)

git clone <repo-url>
cd <repo-folder>

npm install
npm install -D wrangler
npx wrangler login

## 2. Create a D1 Database

npx wrangler d1 create collaborative_editor

# Output will show something like:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Copy this database_id and paste it inside wrangler.toml.

## 3. Create KV Namespace (for caching)

npx wrangler kv namespace create REALTIME_EDITOR_CACHE

# Output will show:
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Copy this KV id and paste it inside wrangler.toml.

## 4. Initialize the Database Schema

npx wrangler d1 execute collaborative_editor --file=./schema.sql

## 5. Development Mode

npm run dev

## 6. Deploy to Cloudflare

npm run deploy

## (Optional) Set Encryption Key

npx wrangler secret put ENCRYPTION_KEY
