# In-Memoria Demo Recording Script

## Concept
Show a **real developer workflow** where Claude uses In-Memoria naturally to understand the codebase and help with tasks.

**Key**: You NEVER mention In-Memoria or tell Claude what tool to use. The improved tool descriptions make Claude pick the right tool automatically.

---

## Pre-Recording Setup

```bash
# Clean slate for fresh demo
rm -rf .in-memoria/*.db

# Build project
npm run build

# Learn the codebase (this creates the intelligence)
./dist/index.js learn .

# Verify MCP server is running and connected to Claude
```

---

## Demo Format Options

### Option 1: Feature Addition Workflow (Most Realistic)
**Duration**: 30-60 seconds
**Shows**: Claude automatically routing you to the right files

**Your prompt** (natural, conversational):
```
Where should I add Ruby language support to the AST parser?
```

**OR**:
```
I need to add Ruby support. What files should I modify?
```

**Why these work**:
- The words "**where**" and "**what files**" trigger `predict_coding_approach`
- The improved tool description tells Claude: "Use this when the user asks 'where should I...' or 'what files...'"
- Claude automatically uses In-Memoria without being told

**Expected flow**:
```
You: "Where should I add Ruby language support to the AST parser?"

Claude: [Automatically calls predict_coding_approach - you'll see tool badge]

Claude: "Based on the codebase, you'll want to work in the language-support
feature. Start with:

• rust-core/src/parsing/manager.rs - Add Ruby to the parser registry
• rust-core/src/parsing/python.rs - Use this as a reference pattern

The project has 8 language parsers already, so follow that pattern."
```

**The magic**: You never said "use In-Memoria" - Claude just knows.

---

### Option 2: Contrast Two Different Intents (Shows Intelligence)
**Duration**: 45-60 seconds
**Shows**: Same question format, totally different file routing = intelligence

**Your first prompt**:
```
Where should I add Ruby language support?
```

**Claude automatically uses In-Memoria** → Routes to `rust-core/src/parsing/`

**Your second prompt** (after first completes):
```
Actually, where should I add database caching instead?
```

**Claude uses In-Memoria again** → Routes to completely different files: `src/storage/`

**Point**:
- Same conversational pattern ("where should I...")
- Totally different results based on intent
- Not keyword matching - actual understanding
- Claude uses In-Memoria both times without being told

---

### Option 3: Project Understanding (Instant Context)
**Duration**: 20-30 seconds
**Shows**: No cold start - instant comprehensive understanding

**Your prompt**:
```
What's the structure of this codebase?
```

**OR**:
```
Give me a project overview
```

**What Claude will do**:
1. Automatically use `get_project_blueprint` (triggered by "structure" or "overview")
2. Show tech stack, entry points, key directories, features
3. All in ~5 seconds, no exploration

**Expected response**:
```
Claude: [Calls get_project_blueprint]

Claude: "Here's the project structure:

**Tech Stack:** TypeScript, Rust, Node.js

**Entry Points:**
• CLI: src/index.ts
• MCP Server: src/mcp-server/index.ts

**Key Directories:**
• src/storage/ (database layer)
• rust-core/src/parsing/ (language support)
• src/services/ (business logic)

**Features:** database, language-support, rust-core, mcp-server,
testing, utilities

Multi-language project with Rust for parsing and TypeScript for
the MCP layer."
```

**The magic**: Complete understanding in seconds, no file reading or exploration.

---

### Option 4: Pattern Discovery (Shows Learning)
**Duration**: 30-40 seconds
**Shows**: In-Memoria learned from YOUR code, not generic patterns

**Your prompt**:
```
I need to create a new service for analytics. What patterns should I follow?
```

**What Claude will do**:
1. Automatically use `get_pattern_recommendations`
2. Show patterns learned from THIS codebase
3. Include confidence scores and occurrence counts

**Expected response**:
```
Claude: [Calls get_pattern_recommendations]

Claude: "Based on patterns in your codebase:

**Dependency Injection** (83% confidence, 1,230 occurrences)
• Your services consistently use constructor injection
• Example from your code: [shows actual code snippet]

**Factory Pattern** (73% confidence, 3,478 occurrences)
• Heavily used for creating service instances

**Singleton** (80% confidence, 10 occurrences)
• Used sparingly for core services like database connections

I'd recommend following the DI pattern - it's the established
standard in this project."
```

**The magic**: These are learned from YOUR code, with real examples and frequencies.

---

## Recording Tips

### Screen Setup
- Claude Code chat visible (right side)
- Terminal on left/bottom (optional)
- Font size: 18-20pt minimum
- Dark theme recommended
- Hide desktop clutter, dock/taskbar

### Pacing
1. **Type naturally** - don't rush your prompt
2. **Wait for tool call** - this is the visual hook (tool badge appears)
3. **Let response render** - don't cut it off mid-sentence
4. **Pause 2-3 seconds at end** - let the result sink in

### What to Show
- Your natural, conversational prompt
- Claude "thinking"
- **THE TOOL CALL BADGE** - this is the magic moment
- Claude's intelligent, helpful response
- Optional: Mouse hover over suggested files

### What NOT to Show
- Don't type "use In-Memoria" or mention tools
- Don't skip the tool call moment - that's proof it's working
- Don't explain what's happening - let the demo speak

---

## Key Prompts That Trigger In-Memoria

These phrases automatically trigger the right tools:

**For file routing** (`predict_coding_approach`):
- "**Where** should I..."
- "**What files** should I modify..."
- "**How do I add**..."
- "**Where do I implement**..."

**For project understanding** (`get_project_blueprint`):
- "What's the **structure**..."
- "Show me the **architecture**..."
- "Give me an **overview**..."
- "What **features** does this have..."

**For pattern guidance** (`get_pattern_recommendations`):
- "What **patterns** should I follow..."
- "**How should I implement**..."
- "I need to **create** a..."

**For code lookup** (`get_semantic_insights`):
- "Where is **[ClassName]** defined..."
- "Show me relationships for **[functionName]**..."
- "What uses **[variableName]**..."

---

## Recommended: Option 1 (Feature Addition)

**Why**:
- Most realistic workflow
- Shows clear value: direct routing vs exploration
- Natural conversation
- Clear visual moment (tool call)
- Demonstrates intelligence, not just search

**Your line**:
```
Where should I add Ruby language support to the AST parser?
```

**That's it.** Let Claude do the rest.

---

## Alternative: Before & After Comparison

**Split screen showing**:

**Before In-Memoria**:
```
You: "Help me add Ruby support"
Claude: "Let me search the codebase..."
[Searches, reads 10 files, explores directories]
[2-3 minutes later]
"OK, after reviewing the code, you'll want to work in..."
```

**With In-Memoria**:
```
You: "Where should I add Ruby support?"
Claude: [Uses In-Memoria, <2 seconds]
"Start with rust-core/src/parsing/manager.rs..."
```

**Point**: 2-3 minutes → 2 seconds. No exploration needed.

---

## Bottom Line

**Don't script Claude. Script YOURSELF.**

- Your job: Ask natural, realistic questions
- Claude's job: Automatically use In-Memoria to help
- The demo: Shows Claude being smarter WITH In-Memoria

**No "use In-Memoria". No "run this tool". Just natural conversation.**

The improved tool descriptions make it automatic.
