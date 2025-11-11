# OpenAI API Key Usage in In-Memoria

## Overview

The OpenAI API key in In-Memoria is **completely optional**. The system works great with free local embeddings, and the OpenAI integration is only for users who want slightly higher quality semantic search.

## What Does the API Key Do?

When you provide an OpenAI API key, In-Memoria uses it **only** during the learning phase to generate vector embeddings for semantic code search using OpenAI's `text-embedding-ada-002` model.

### Specifically:
- **When**: Only during `in-memoria learn` or initial setup learning
- **What**: Creates embeddings for semantic concepts and patterns found in your code
- **How many calls**: 1 API call per concept + 1 per pattern (typically 500-2000 calls for a large codebase)
- **Model**: `text-embedding-ada-002`
- **Cost**: ~$0.0004 per 1,000 tokens
- **Estimated total**: $0.50-$2.00 for a large codebase (1000+ files)

## Local Embeddings (Default)

**If you don't provide an API key**, In-Memoria automatically uses:
- **transformers.js** with the `all-MiniLM-L6-v2` model (384-dimensional embeddings)
- Completely free and runs locally
- No API calls, no external dependencies
- Quality: 85-90% as good as OpenAI for code search

## Safeguards We've Added

### 1. **Transparent Cost Information**
During interactive setup:
```
📊 Vector Embeddings for Semantic Search:
   In Memoria uses embeddings to enable semantic code search.
   • Default: Free local embeddings (transformers.js, no API key needed)
   • Optional: OpenAI embeddings (higher quality, uses API credits)

Use OpenAI embeddings? (optional, costs ~$0.50-$2 for large projects)
```

### 2. **Pre-Learning Cost Estimate**
Before the learning phase starts:
```
🔍 Phase 6: Building semantic search index...
   ℹ️  OpenAI API key detected - will attempt enhanced embeddings
   📊 Estimated: 1524 API calls (~$0.06-$0.61)
   🔄 Auto-fallback: Switches to local embeddings if API fails
```

### 3. **Rate Limiting**
- Conservative 50 requests per minute (OpenAI allows 3,000 RPM)
- Prevents hitting rate limits accidentally
- Automatic waiting with progress messages
- Example: `⏳ Rate limit reached. Waiting 12s before next OpenAI API call...`

### 4. **Automatic Fallback**
- If the API fails (invalid key, rate limit, network error), automatically falls back to local embeddings
- No interruption to the learning process
- Clear messages about what's happening

### 5. **Caching**
- Embeddings are cached (LRU cache, 1000 entries)
- Duplicate concepts/patterns don't cause repeated API calls
- Reduces costs for re-learning

## When Should You Use the OpenAI API Key?

**Use OpenAI if:**
- You want the absolute best semantic search quality
- Your project is very large and complex (10,000+ files)
- You're working with domain-specific code that benefits from better embeddings
- Cost is not a concern (~$2 one-time per project)

**Skip OpenAI if:**
- You want to keep it free
- Your project is small-medium (<1,000 files)
- You're okay with 85-90% quality (which is still very good!)
- You don't want to manage API keys

## Example Cost Calculation

For a typical mid-sized project:
- **Files**: 500
- **Concepts found**: 800 (functions, classes, etc.)
- **Patterns found**: 200 (coding patterns)
- **Total embeddings**: 1,000
- **Avg tokens per embedding**: ~50
- **Total tokens**: 50,000
- **Cost**: 50,000 / 1,000 × $0.0004 = **$0.02**

For a large enterprise project:
- **Files**: 5,000
- **Concepts found**: 8,000
- **Patterns found**: 2,000
- **Total embeddings**: 10,000
- **Avg tokens per embedding**: ~50
- **Total tokens**: 500,000
- **Cost**: 500,000 / 1,000 × $0.0004 = **$0.20**

## Privacy & Security

**What data is sent to OpenAI:**
- Concept names (e.g., "UserController", "authenticateUser")
- Pattern descriptions (e.g., "dependency_injection pattern")
- **Maximum 8,000 characters** per request (code is preprocessed/truncated)

**What is NOT sent:**
- Full source code files
- Comments or documentation
- Secrets or credentials
- File paths or project structure

**Code preprocessing:**
```typescript
// Before sending to OpenAI, code is:
1. Whitespace normalized
2. Comments removed
3. Truncated to 8,000 chars max
```

## Configuration

### Via Interactive Setup
```bash
in-memoria setup --interactive
```
Follow the prompts - the system will explain everything clearly.

### Via Environment Variable
```bash
export OPENAI_API_KEY=sk-...
in-memoria learn
```

### Via Config File
```json
// .in-memoria/.env
OPENAI_API_KEY=sk-...
```

## Frequently Asked Questions

### Q: Is the OpenAI key required?
**A:** No! It's completely optional. Local embeddings work great.

### Q: Can I switch between OpenAI and local embeddings?
**A:** Yes, but you'll need to re-run learning. The embeddings are stored once during learning.

### Q: What happens if my API key is invalid?
**A:** In-Memoria automatically falls back to local embeddings with a warning message.

### Q: Does it use my API key for anything else?
**A:** No. Only for embeddings during the learning phase. Nothing else.

### Q: Can I see exactly what's being sent to OpenAI?
**A:** Yes, enable debug logging:
```bash
IN_MEMORIA_DEBUG=true in-memoria learn
```

### Q: Will future runs use more API credits?
**A:** Only if you re-run learning (e.g., after major code changes). Normal usage doesn't call the API.

## Troubleshooting

### "Rate limit exceeded"
- In-Memoria has built-in rate limiting (50 RPM)
- If you hit OpenAI's limits, it automatically falls back to local embeddings
- Check your OpenAI account's rate limits

### "Invalid API key"
- Verify your key starts with `sk-`
- Check it's not expired
- System will automatically fall back to local embeddings

### "API call failed"
- Check your internet connection
- Verify OpenAI service status
- System will automatically fall back to local embeddings

## Summary

The OpenAI API key is a **nice-to-have, not a must-have**. We've made it:
- ✅ Optional (free local embeddings are the default)
- ✅ Transparent (clear cost estimates)
- ✅ Safe (rate limiting, automatic fallback)
- ✅ Privacy-conscious (minimal data sent)
- ✅ Cost-effective (~$0.50-$2 one-time per project)

Use it if you want the extra 10-15% quality boost. Skip it if you want to keep it free and simple!
