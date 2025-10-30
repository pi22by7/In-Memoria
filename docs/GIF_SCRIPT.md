# In-Memoria GIF Demo Script (30 seconds)

## Concept
Show **instant project understanding** - no exploration, just answers.

---

## Pre-Recording Setup

```bash
# Clean slate
rm -rf .in-memoria/*.db

# Build and learn
npm run build
./dist/index.js learn .
```

---

## The Script

### Your Prompt (Type This)
```
What's the structure of this codebase?
```

**OR** (more specific):
```
Show me the project blueprint
```

### What Claude Will Do
1. Use `mcp__in_memoria__get_project_blueprint()`
2. Show you:
   - **Tech stack**: TypeScript, Rust, Node.js
   - **Entry points**: CLI, MCP server, learning pipeline
   - **Key directories**: storage, parsing, services
   - **Feature map**: database, language-support, rust-core, mcp-server, testing, utilities

### Expected Response (15-20 seconds)
```
Claude: "Let me check the project structure..."
[Calls mcp__in_memoria__get_project_blueprint]

Claude: "Here's the blueprint of your codebase:

**Tech Stack:**
- TypeScript, Rust, Node.js

**Entry Points:**
- CLI: src/index.ts
- MCP Server: src/mcp-server/index.ts

**Key Directories:**
- src/storage/ (database layer, 3 files)
- rust-core/src/parsing/ (language support, 15 files)
- src/services/ (business logic)

**Features:**
- database, language-support, rust-core, mcp-server,
  testing, utilities, configuration

This is a multi-language project with Rust for parsing
and TypeScript for the MCP server layer."
```

---

## Visual Flow

**0:00-0:03** - You type: "What's the structure of this codebase?"
**0:03-0:05** - Claude thinking...
**0:05-0:07** - Tool call visible: `get_project_blueprint()`
**0:07-0:25** - Response renders (tech stack, entry points, features)
**0:25-0:30** - Pause on final response

---

## Text Overlays (Optional)

**During tool call** (0:05-0:07):
```
"Using In-Memoria..."
```

**At end** (0:28-0:30):
```
"Instant context. No exploration."
```

---

## Recording Tips

### Setup
- Claude Code open, chat visible
- Font: 18-20pt
- Dark theme
- Hide clutter

### Keep It Simple
- Type the prompt naturally
- **Don't skip the tool call moment** - that's the magic
- Let the response fully render
- Pause 2 seconds at end

### What Makes It Good
- Shows **instant understanding** (no file reading, no searching)
- Blueprint appears in seconds
- Comprehensive: tech stack + structure + features
- Clear value: "No cold starts"

---

## Why This Works for a GIF

✅ **Single, clear question**: "What's the structure?"
✅ **Single, impressive answer**: Complete blueprint
✅ **Visual moment**: Tool call badge appears
✅ **Clear value prop**: Instant vs. having to explore
✅ **Fits in 30 seconds**: Question (3s) + Tool (2s) + Answer (20s) + Pause (5s)

---

## Alternative Short Prompts

If you want to vary:

**Option A** (Focus on features):
```
What features does this project have?
```

**Option B** (Focus on architecture):
```
What's the architecture of this codebase?
```

**Option C** (Direct):
```
Give me a project overview
```

All will trigger the blueprint tool naturally.

---

## Bottom Line

**Your line**: "What's the structure of this codebase?"

**Claude's job**: Show the blueprint using In-Memoria

**Result**: 30 seconds showing instant, comprehensive understanding

**No exploration. No cold start. Just answers.**
