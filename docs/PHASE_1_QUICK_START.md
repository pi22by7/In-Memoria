# Phase 1 Quick Start Guide

## Overview

Phase 1 introduces three game-changing features that make In-Memoria indispensable:

1. **Incremental Learning** - Intelligence that updates automatically with every commit
2. **Pattern Conflict Detection** - Real-time warnings when you violate your own coding patterns
3. **Cross-Project Intelligence** - Leverage experience from ALL your projects, not just one

This guide will get you up and running with Phase 1 features in under 5 minutes.

---

## Feature 1: Pattern Compliance Checking

### What It Does
Checks your code against learned patterns before you commit, catching inconsistencies early.

### Quick Start

```typescript
// 1. After writing code, check it for pattern violations
const compliance = await check_pattern_compliance({
  file_path: 'src/services/new-feature.ts',
  severity_threshold: 'medium'  // Only show medium+ severity issues
});

// 2. Review results
console.log(`Score: ${compliance.overallScore}/100`);
console.log(`Violations: ${compliance.violations.length}`);

// 3. Fix violations
compliance.violations.forEach(v => {
  console.log(`${v.severity}: ${v.message}`);
  if (v.suggestedFix) {
    console.log(`  Fix: ${v.suggestedFix}`);
  }
});
```

### Real Example

```typescript
// Your code:
const user_id = getUserId();  // snake_case

// Pattern violation detected:
{
  severity: "medium",
  message: "Variable 'user_id' uses snake_case, but you typically use camelCase (92% confidence)",
  suggestedFix: "const userId = getUserId();"
}
```

### When to Use
- ✅ Before committing new code
- ✅ During code review
- ✅ When refactoring
- ✅ To learn project conventions quickly

---

## Feature 2: Cross-Project Intelligence

### What It Does
Links all your projects together so you can search across them and share patterns.

### Quick Start

```typescript
// 1. Link your projects (one-time setup)
await link_project({
  project_path: '/Users/dev/projects/frontend-app',
  project_name: 'Frontend',
  auto_sync: true  // Automatically share patterns
});

await link_project({
  project_path: '/Users/dev/projects/backend-api',
  project_name: 'Backend'
});

// 2. View your portfolio
const portfolio = await get_portfolio_view({});
console.log(`${portfolio.summary.totalProjects} projects linked`);
console.log(`${portfolio.summary.totalPatterns} shared patterns`);

// 3. Search across ALL projects
const results = await search_all_projects({
  query: 'JWT authentication',
  mode: 'semantic',
  limit: 10
});

// Results include matches from ALL linked projects
results.results.forEach(r => {
  console.log(`Found in ${r.projectName}:`);
  console.log(`  File: ${r.filePath}`);
  console.log(`  Score: ${r.match.score}/100`);
  console.log(`  Code: ${r.match.code}`);
});

// 4. Get patterns that work across multiple projects
const globalPatterns = await get_global_patterns({
  category: 'error_handling',
  min_project_count: 2,  // Must appear in 2+ projects
  min_consensus: 0.7  // 70%+ consistency across projects
});

globalPatterns.patterns.forEach(p => {
  console.log(`Pattern: ${p.pattern}`);
  console.log(`  Used in ${p.projectCount} projects`);
  console.log(`  Confidence: ${p.confidence}%`);
});
```

### Real Example

```typescript
// Search finds authentication code in 3 different projects:
{
  results: [
    {
      projectName: "Frontend",
      filePath: "src/auth/login.ts",
      match: {
        code: "async function validateJWT(token: string) {...}",
        score: 95
      }
    },
    {
      projectName: "Backend",
      filePath: "middleware/auth.ts",
      match: {
        code: "const verifyToken = async (token) => {...}",
        score: 92
      }
    },
    {
      projectName: "Mobile App",
      filePath: "utils/auth.js",
      match: {
        code: "function checkJWT(authToken) {...}",
        score: 88
      }
    }
  ]
}
```

### When to Use
- ✅ "I solved this before, but which project was it in?"
- ✅ Finding patterns that work across multiple projects
- ✅ Ensuring consistency across your entire portfolio
- ✅ Onboarding to a new project faster

---

## Feature 3: Incremental Learning

### What It Does
Automatically updates intelligence from your commits - no more full rescans.

### Quick Start

```typescript
// 1. View what was learned from recent commits
const history = await get_learning_history({
  limit: 5  // Last 5 learning deltas
});

history.deltas.forEach(delta => {
  console.log(`\nCommit: ${delta.commitSha?.substring(0, 7)}`);
  console.log(`Message: ${delta.commitMessage}`);
  console.log(`Files changed: ${delta.filesChanged}`);
  console.log(`Duration: ${delta.durationMs}ms`);

  console.log(`Changes:`);
  console.log(`  +${delta.summary.conceptsAdded} concepts added`);
  console.log(`  ~${delta.summary.conceptsModified} concepts modified`);
  console.log(`  -${delta.summary.conceptsRemoved} concepts removed`);
  console.log(`  +${delta.summary.patternsAdded} patterns learned`);
});

// 2. View summary stats
console.log('\nTotal across all deltas:');
console.log(`  Concepts added: ${history.summary.totalConceptsAdded}`);
console.log(`  Concepts removed: ${history.summary.totalConceptsRemoved}`);
console.log(`  Patterns added: ${history.summary.totalPatternsAdded}`);
```

### Real Example

```typescript
// Output after 3 commits:
Commit: a3f4b2c
Message: Add user authentication
Files changed: 3
Duration: 1243ms
Changes:
  +12 concepts added
  ~3 concepts modified
  -0 concepts removed
  +4 patterns learned

Commit: d5e6f7g
Message: Refactor error handling
Files changed: 8
Duration: 2156ms
Changes:
  +5 concepts added
  ~15 concepts modified
  -2 concepts removed
  +2 patterns learned

Commit: h8i9j0k
Message: Update API endpoints
Files changed: 5
Duration: 987ms
Changes:
  +8 concepts added
  ~7 concepts modified
  -1 concepts removed
  +3 patterns learned

Total across all deltas:
  Concepts added: 25
  Concepts removed: 3
  Patterns added: 9
```

### When to Use
- ✅ Checking if changes were learned correctly
- ✅ Debugging stale intelligence
- ✅ Understanding what the system knows
- ✅ Performance monitoring (should be <5s per delta)

---

## Complete Workflow Example

### Scenario: Adding a New Feature

```typescript
// === STEP 1: Check if your projects are linked ===
const portfolio = await get_portfolio_view({});
console.log(`Working with ${portfolio.summary.totalProjects} projects`);

// === STEP 2: Search for similar implementations across projects ===
const examples = await search_all_projects({
  query: 'password reset email verification',
  mode: 'semantic',
  limit: 5
});

console.log('Found similar implementations:');
examples.results.forEach(r => {
  console.log(`  ${r.projectName}: ${r.filePath}`);
});

// === STEP 3: Get global patterns for this type of feature ===
const patterns = await get_global_patterns({
  category: 'implementation',
  min_project_count: 2  // Patterns used in 2+ projects are battle-tested
});

console.log('Recommended patterns:');
patterns.patterns.forEach(p => {
  console.log(`  ${p.pattern} (used in ${p.projectCount} projects)`);
});

// === STEP 4: Implement your feature ===
// ... write code ...

// === STEP 5: Check pattern compliance before committing ===
const compliance = await check_pattern_compliance({
  file_path: 'src/auth/password-reset.ts',
  severity_threshold: 'medium'
});

if (!compliance.passed) {
  console.log(`⚠️ Pattern violations found (score: ${compliance.overallScore}/100)`);
  compliance.violations.forEach(v => {
    console.log(`  ${v.severity}: ${v.message}`);
    if (v.suggestedFix) {
      console.log(`    Fix: ${v.suggestedFix}`);
    }
  });
} else {
  console.log(`✅ Pattern compliance: ${compliance.overallScore}/100`);
}

// === STEP 6: After committing, verify it was learned ===
setTimeout(async () => {
  const history = await get_learning_history({ limit: 1 });
  const latest = history.deltas[0];

  console.log(`\nLearned from your commit:`);
  console.log(`  +${latest.summary.conceptsAdded} new concepts`);
  console.log(`  +${latest.summary.patternsAdded} new patterns`);
  console.log(`  Duration: ${latest.durationMs}ms`);
}, 5000);  // Wait 5 seconds for learning to complete
```

---

## Integration with Git Hooks (Optional)

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check pattern compliance before allowing commit
echo "Checking pattern compliance..."

# Get list of staged files
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|tsx|jsx)$')

VIOLATIONS=0

for FILE in $FILES; do
  # Check each file (requires In-Memoria CLI)
  RESULT=$(in-memoria check-compliance "$FILE" --threshold=medium)

  if [ $? -ne 0 ]; then
    echo "❌ Pattern violations in $FILE"
    echo "$RESULT"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "⚠️ Found pattern violations in $VIOLATIONS file(s)"
  echo "Fix violations or use 'git commit --no-verify' to bypass"
  exit 1
fi

echo "✅ Pattern compliance check passed"
exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## Tips & Best Practices

### 1. Link Projects Early
Link all your projects when you first start using Phase 1. The more projects linked, the stronger the global patterns.

```typescript
// Link all your projects in one go:
const projectPaths = [
  '/Users/dev/projects/frontend',
  '/Users/dev/projects/backend',
  '/Users/dev/projects/mobile-app',
  '/Users/dev/projects/admin-panel'
];

for (const path of projectPaths) {
  await link_project({
    project_path: path,
    auto_sync: true
  });
}
```

### 2. Set Appropriate Severity Thresholds
- Use `'high'` threshold for strict enforcement
- Use `'medium'` for balanced checking (recommended)
- Use `'low'` to see all suggestions

```typescript
// For critical files (production code):
await check_pattern_compliance({
  file_path: 'src/core/payment.ts',
  severity_threshold: 'high'  // Only fail on high-severity issues
});

// For exploratory code:
await check_pattern_compliance({
  file_path: 'src/experimental/new-idea.ts',
  severity_threshold: 'low'  // See all suggestions
});
```

### 3. Monitor Learning Performance
If learning takes >5 seconds per commit, check the delta history:

```typescript
const history = await get_learning_history({ limit: 10 });
const slowDeltas = history.deltas.filter(d => d.durationMs > 5000);

if (slowDeltas.length > 0) {
  console.log('Slow learning deltas detected:');
  slowDeltas.forEach(d => {
    console.log(`  ${d.commitSha}: ${d.durationMs}ms (${d.filesChanged} files)`);
  });
}
```

### 4. Use Global Patterns Wisely
Global patterns are stronger when they appear in multiple projects with high consensus:

```typescript
// Get only the most reliable patterns:
const patterns = await get_global_patterns({
  min_project_count: 3,  // Must appear in 3+ projects
  min_consensus: 0.85  // 85%+ consistency
});

// These patterns are battle-tested across multiple projects
```

---

## Troubleshooting

### "No patterns found" when checking compliance
**Cause:** Project hasn't been learned yet or patterns haven't been discovered.

**Solution:**
```typescript
// Ensure project is learned:
await auto_learn_if_needed({ path: '.' });

// Then check again:
const compliance = await check_pattern_compliance({ file_path: '...' });
```

### "Project not found" when searching across projects
**Cause:** Project hasn't been linked to global intelligence.

**Solution:**
```typescript
// Link the project:
await link_project({
  project_path: '/path/to/project',
  project_name: 'My Project'
});

// Verify it's linked:
const portfolio = await get_portfolio_view({});
console.log(portfolio.projects);  // Should show your project
```

### Learning deltas show 0 changes
**Cause:** No code changes detected or changes in ignored files.

**Solution:**
```typescript
// Check what files were changed:
const history = await get_learning_history({ limit: 1 });
console.log(history.deltas[0].filesChanged);  // Should show changed files

// If empty, commits might not have code changes
```

---

## What's Next?

After mastering Phase 1, explore:

- **Phase 2**: VS Code extension, Git hooks, CLI improvements
- **Phase 3**: Architecture drift detection, security patterns
- **Phase 4**: Advanced search (time-travel, visual code maps)
- **Phase 5**: Cloud sync, pattern versioning, memory snapshots

See `FEATURE_ROADMAP.md` for the complete roadmap.

---

## Need Help?

- 📖 Full documentation: `AGENT.md`
- 🗺️ Feature roadmap: `FEATURE_ROADMAP.md`
- 🔧 Implementation details: `docs/PHASE_1_IMPLEMENTATION.md`
- 💬 Report issues: https://github.com/anthropics/claude-code/issues

---

*Last Updated: 2025-11-17*
*Phase 1 Version: v0.7.0*
