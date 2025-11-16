
# 📚 Reference Guide

## Essential Commands

### Initial Setup
```bash
# Install Wrangler
npm install -D wrangler

# Login to Cloudflare
npx wrangler login

# Check login status
npx wrangler whoami
```

### Database Setup
```bash
# Create D1 database
npx wrangler d1 create realtime_editor

# Initialize schema
npx wrangler d1 execute realtime_editor --file=./schema.sql

# Query database
npx wrangler d1 execute realtime_editor --command "SELECT * FROM editors LIMIT 10"

# Delete specific editor
npx wrangler d1 execute realtime_editor --command "DELETE FROM editors WHERE id='EDITOR_ID'"

# Clear all editors
npx wrangler d1 execute realtime_editor --command "DELETE FROM editors"
```

### KV Setup
```bash
# Create KV namespace
npx wrangler kv:namespace create CACHE

# List all KV namespaces
npx wrangler kv:namespace list

# Put value in KV
npx wrangler kv:key put --namespace-id=YOUR_ID "key" "value"

# Get value from KV
npx wrangler kv:key get --namespace-id=YOUR_ID "key"

# Delete key from KV
npx wrangler kv:key delete --namespace-id=YOUR_ID "key"
```

### Development
```bash
# Start local dev server
npm run dev
# or
npx wrangler dev

# Start with specific port
npx wrangler dev --port 3000

# Start with local mode (for D1)
npx wrangler dev --local

# Start with remote mode (uses production D1)
npx wrangler dev --remote
```

### Deployment
```bash
# Deploy to production
npm run deploy
# or
npx wrangler deploy

# Deploy with specific name
npx wrangler deploy --name my-editor

# View deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback

# Rollback to specific version
npx wrangler rollback --message "Rollback to stable version"
```

### Monitoring
```bash
# View live logs (tail)
npm run tail
# or
npx wrangler tail

# View specific number of logs
npx wrangler tail --format pretty

# Filter logs
npx wrangler tail --status error
npx wrangler tail --status ok
```

### Secrets Management
```bash
# Set secret
npx wrangler secret put ENCRYPTION_KEY

# List secrets
npx wrangler secret list

# Delete secret
npx wrangler secret delete ENCRYPTION_KEY
```

---

## 🔧 Troubleshooting Guide

### Problem: "Error: No account found"
```bash
# Solution: Login again
npx wrangler logout
npx wrangler login
```

### Problem: "D1 database not found"
```bash
# Solution: Recreate database
npx wrangler d1 create realtime_editor
# Update wrangler.toml with new database_id
npx wrangler d1 execute realtime_editor --file=./schema.sql
```

### Problem: "KV namespace not found"
```bash
# Solution: Recreate KV namespace
npx wrangler kv:namespace create CACHE
# Update wrangler.toml with new id
```

### Problem: "Durable Object not found"
```bash
# Solution: Check wrangler.toml configuration
# Ensure migrations section exists:
[[migrations]]
tag = "v1"
new_classes = ["EditorDurableObject"]

# Then redeploy
npx wrangler deploy
```

### Problem: "WebSocket connection fails"
```bash
# Check 1: Verify Durable Objects are enabled
npx wrangler whoami

# Check 2: Test local WebSocket
npx wrangler dev --local
# Open browser console and check for errors

# Check 3: Check CORS configuration in index.js
```

### Problem: "Worker exceeds size limit"
```bash
# Solution 1: Check bundle size
npx wrangler deploy --dry-run --outdir=dist

# Solution 2: Minimize dependencies
# Remove unused imports

# Solution 3: Use external assets
# Move large files to R2 or external CDN
```

### Problem: "CPU time limit exceeded"
```bash
# Solution: Optimize async operations
# - Use async/await properly
# - Avoid synchronous operations
# - Implement caching
# - Use KV for frequently accessed data
```

---

## 📊 Useful Queries

### D1 Database Queries
```sql
-- Count total editors
SELECT COUNT(*) as total FROM editors;

-- Get recent editors
SELECT id, updated_at FROM editors 
ORDER BY updated_at DESC LIMIT 10;

-- Find large editors
SELECT id, LENGTH(content) as size FROM editors 
ORDER BY size DESC LIMIT 10;

-- Delete old editors (older than 30 days)
DELETE FROM editors 
WHERE updated_at < strftime('%s','now','-30 days') * 1000;

-- Get editor by ID
SELECT * FROM editors WHERE id = 'YOUR_EDITOR_ID';
```

### KV Operations via CLI
```bash
# List all keys with prefix
npx wrangler kv:key list --namespace-id=YOUR_ID --prefix="editor:"

# Bulk delete keys
npx wrangler kv:bulk delete --namespace-id=YOUR_ID filename.json
# filename.json format: ["key1", "key2", "key3"]

# Export all keys
npx wrangler kv:key list --namespace-id=YOUR_ID > keys.json
```

---

## 🧪 Testing Commands

### Test Health Endpoint
```bash
curl https://your-worker.workers.dev/health
```

### Test Editor Load
```bash
curl https://your-worker.workers.dev/editor/load/test123
```

### Test Editor Save
```bash
curl -X POST https://your-worker.workers.dev/editor/save/test123 \
  -H "Content-Type: application/json"
```

### Test Editor Delete
```bash
curl -X DELETE https://your-worker.workers.dev/editor/delete/test123
```

### Test WebSocket (using websocat)
```bash
# Install websocat: cargo install websocat
websocat wss://your-worker.workers.dev/ws/test123
```

---

## 📈 Performance Testing

### Using Apache Bench
```bash
# Test health endpoint
ab -n 1000 -c 10 https://your-worker.workers.dev/health

# Test load endpoint
ab -n 100 -c 5 https://your-worker.workers.dev/editor/load/test123
```

### Using curl (response time)
```bash
curl -w "@curl-format.txt" -o /dev/null -s \
  https://your-worker.workers.dev/health

# curl-format.txt content:
#     time_namelookup:  %{time_namelookup}\n
#        time_connect:  %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#    time_pretransfer:  %{time_pretransfer}\n
#       time_redirect:  %{time_redirect}\n
#  time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n
```

---

## 🔍 Debugging

### Enable Debug Mode
```bash
# Local development with debug
npx wrangler dev --local --log-level debug

# View detailed logs
npx wrangler tail --format pretty
```

### Check Worker Logs in Dashboard
1. Go to Cloudflare Dashboard
2. Workers & Pages → Your Worker
3. Click "Logs" tab
4. Select "Real-time Logs"

### Common Log Patterns
```javascript
// Add to your code for debugging
console.log('Editor joined:', { editorId, timestamp: Date.now() });
console.error('Error in save:', { error: error.message, stack: error.stack });
console.warn('Large content detected:', { size: content.length });
```

---

## 🛠️ Configuration Files

### wrangler.toml Quick Template
```toml
name = "realtime-editor"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "realtime_editor"
database_id = "INSERT_YOUR_DATABASE_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "INSERT_YOUR_KV_ID"

[[durable_objects.bindings]]
name = "EDITOR"
class_name = "EditorDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["EditorDurableObject"]
```

### package.json Scripts
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "db:create": "wrangler d1 create realtime_editor",
    "db:init": "wrangler d1 execute realtime_editor --file=./schema.sql",
    "db:query": "wrangler d1 execute realtime_editor --command",
    "kv:create": "wrangler kv:namespace create CACHE"
  }
}
```

---

## 🎯 Cheat Sheet

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Deploy | `npm run deploy` |
| View logs | `npm run tail` |
| Create D1 DB | `npm run db:create` |
| Init DB schema | `npm run db:init` |
| Create KV | `npm run kv:create` |
| Set secret | `wrangler secret put KEY` |
| Rollback | `wrangler rollback` |
| Check status | `wrangler whoami` |

---

## 📱 Mobile Testing

### Test on mobile device
1. Deploy your worker
2. Get the URL: `https://your-worker.workers.dev`
3. Open on mobile browser
4. Test real-time collaboration between mobile and desktop

### Local network testing
```bash
# Start dev server with network access
npx wrangler dev --ip 0.0.0.0 --port 8787

# Access from mobile on same network
# http://YOUR_LOCAL_IP:8787
```

---

## 🔐 Security Checklist

- [ ] Set `ENCRYPTION_KEY` secret
- [ ] Enable rate limiting (implement in code)
- [ ] Validate all inputs
- [ ] Use HTTPS only
- [ ] Implement CORS properly
- [ ] Add authentication for sensitive editors
- [ ] Regular security audits
- [ ] Monitor for unusual activity

---

## 📞 Support Resources

- **Cloudflare Discord**: https://discord.gg/cloudflaredev
- **Cloudflare Docs**: https://developers.cloudflare.com
- **Wrangler GitHub**: https://github.com/cloudflare/workers-sdk
- **Community Forum**: https://community.cloudflare.com

---

*Ignore* For my local setup. 

package.json scripts code
"scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:init": "wrangler d1 execute realtime --file=./schema.sql",
    "db:create": "wrangler d1 create realtime",
    "kv:create": "wrangler kv namespace create REALTIME_EDITOR_CACHE",
    "tail": "wrangler tail"
  },
  "scripts": {
    "dev": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js dev",
    "deploy": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js deploy",
    "db:init": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js d1 execute realtime --file=./schema.sql",
    "db:create": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js d1 create realtime",
    "kv:create": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js kv namespace create REALTIME_EDITOR_CACHE",
    "tail": "C:\\Users\\Md.Ahmad\\Documents\\helpers\\node-versions\\node-v20.18.3\\node.exe .\\node_modules\\wrangler\\bin\\wrangler.js tail"
  },
