# In-Memoria 30-Second GIF Demo Script

## Instructions for Claude

You are assisting with recording a 30-second GIF demo of In-Memoria. When the user asks you to execute the demo, you should:

### Your Role
1. Execute the file routing queries in sequence (Option B below)
2. Present results in a clean, demo-friendly format
3. Keep responses concise and visually clear for screen recording
4. Highlight the key point: Different intents route to completely different files

### Execution Steps
When prompted, run these two MCP queries:

**Query 1**: Language Support
```javascript
mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add Ruby language support to the AST parser"
})
```
- Expected feature: `language-support`
- Expected files: `rust-core/src/parsing/*`

**Query 2**: Database Optimization
```javascript
mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add caching layer to database queries"
})
```
- Expected feature: `database`
- Expected files: `src/storage/*`

### Output Format
Present each result showing:
- The intended feature detected
- The target files suggested
- The confidence score
- Brief reasoning

Keep it clean and scannable for recording.

---

## Goal
Show the core value proposition: **Instant codebase intelligence without exploration**.

## The Script (30 seconds)

### Setup (do before recording)
```bash
# Ensure fresh learning
rm -rf .in-memoria/*.db
./dist/index.js learn .
```

### Recording (pick ONE of these options)

---

## Option A: Learning + Blueprint (Simplest)

**Duration**: ~30 seconds

```bash
# Show learning (5 seconds)
./dist/index.js learn .

# Wait for completion, then show instant context (5 seconds)
# In MCP client or code:
mcp__in_memoria__get_project_blueprint()
```

**Text overlay**:
1. "Learn your codebase once" (during learning)
2. "Get instant context forever" (during blueprint query)
3. "No cold starts. No exploration." (at end)

---

## Option B: File Routing Focus (Most Impressive)

**Duration**: ~25 seconds

**Show side-by-side or sequential**:

```javascript
// Query 1: Language support
mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add Ruby language support"
})
// → Routes to: rust-core/src/parsing/

// Query 2: Database optimization
mcp__in_memoria__predict_coding_approach({
  problemDescription: "Add database caching"
})
// → Routes to: src/storage/
```

**Text overlay**:
1. "Intent-based file routing"
2. "No keyword matching. Real understanding."

---

## Option C: Pattern Learning (Unique Feature)

**Duration**: ~20 seconds

```javascript
mcp__in_memoria__get_pattern_recommendations({
  problemDescription: "create a new service class"
})

// Shows: Factory, DependencyInjection, Singleton patterns
// With confidence scores from YOUR codebase
```

**Text overlay**:
1. "Learns patterns from YOUR code"
2. "Not hardcoded. Real intelligence."
3. "1230 DI patterns. 3478 Factory patterns."

---

## Recommended: Option B (File Routing)

**Why**: Most visually compelling, shows differentiation from simple search.

**Format**:
```
┌─────────────────────────────────┐
│ Query: "Add Ruby support"       │
│ → rust-core/src/parsing/        │
│   manager.rs, python.rs          │
├─────────────────────────────────┤
│ Query: "Add database caching"   │
│ → src/storage/                  │
│   sqlite-db.ts                  │
└─────────────────────────────────┘

"Intent-based routing. Not keyword matching."
```

## Recording Checklist

- [ ] Font size: 18-20pt
- [ ] Terminal: Full screen, dark theme
- [ ] Hide desktop clutter
- [ ] Record at 60fps (smooth)
- [ ] Keep mouse movements minimal
- [ ] Add 1 second pause at the end
- [ ] Export as GIF with good compression

## Text Overlays (use sparingly)

**Opening** (2 seconds):
```
"In-Memoria: Codebase Intelligence for AI Agents"
```

**Closing** (2 seconds):
```
"No cold starts. Real understanding."
github.com/yourusername/in-memoria
```

## Alternative: Terminal Recording Only

If you want pure terminal (no MCP UI):

```bash
# Clear screen
clear

# Show learning (5 sec)
./dist/index.js learn .

# Show quick analysis (5 sec)
./dist/index.js analyze .

# Show pattern count or similar
# (shows output from learning)
```

---

## Pro Tip: asciinema

Record with asciinema for perfect terminal recording:

```bash
# Record
asciinema rec demo.cast

# Convert to GIF
agg demo.cast demo.gif --theme monokai --font-size 18
```

Much better quality than screen recording!

---

**Bottom Line**: For 30 seconds, show ONE thing really well. File routing is your killer feature.
