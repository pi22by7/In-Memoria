# Token Overflow Issue - Root Cause Analysis

**Date**: 2025-11-12
**Reported by**: shaunie2fly
**Severity**: High - Blocking MCP usage in Claude Code

## Problem Summary

Users are experiencing token overflow errors when calling certain In-Memoria MCP tools:
- `get_pattern_recommendations`: Returns 58,415 tokens (limit: 25,000)
- `get_developer_profile`: Returns 58,435 tokens (limit: 25,000)

Error message:
```
Error: MCP tool "get_pattern_recommendations" response (58415 tokens) exceeds
maximum allowed tokens (25000). Please use pagination, filtering, or limit
parameters to reduce the response size.
```

## Root Cause

### 1. Unbounded Database Queries

**Location**: `src/storage/sqlite-db.ts:209-234`

```typescript
getDeveloperPatterns(patternType?: string): DeveloperPattern[] {
    let query = 'SELECT * FROM developer_patterns';
    // ... NO LIMIT CLAUSE
    const rows = stmt.all(...params) as any[];
    return rows.map(row => ({
      // ... includes ALL examples
      examples: JSON.parse(row.examples || '[]'),
    }));
}
```

**Problem**: This method returns **ALL patterns** from the database with no pagination or limit. For large codebases, this can be hundreds or thousands of patterns.

### 2. Full Code Examples Included

**Location**: `src/mcp-server/tools/intelligence-tools.ts:403-409`

```typescript
preferredPatterns: patterns.slice(0, 10).map(p => ({
  pattern: p.patternId,
  description: p.patternContent.description || 'Developer pattern',
  confidence: p.confidence,
  examples: p.examples.map(ex => ex.code || ''),  // ALL examples
  reasoning: `Used ${p.frequency} times`
})),
```

**Problem**: Each pattern includes **all code examples** (full code snippets), which are serialized into the JSON response. Even though only 10 patterns are returned, each pattern can have many examples.

### 3. Multiple Tool Calls Affected

Both tools fetch all patterns from the database:

**`getPatternRecommendations`** (line 291):
```typescript
const patterns = this.database.getDeveloperPatterns();  // Gets ALL
```

**`getDeveloperProfile`** (line 394):
```typescript
const patterns = this.database.getDeveloperPatterns();  // Gets ALL
```

## Why This Wasn't Caught Earlier

1. **Recent Changes**: The PHP extractor enhancement (commit `e0bc572`) and other recent improvements likely increased the number of patterns learned from codebases
2. **Testing on Small Codebases**: Development and testing likely used smaller projects that didn't trigger the limit
3. **No Token Limit Enforcement**: In-Memoria doesn't enforce token limits internally - relies on MCP client limits

## Impact Analysis

- **Severity**: High - Completely blocks usage of these tools in Claude Code
- **Affected Users**: Any user with a moderately-sized codebase (500+ files)
- **Affected Tools**:
  - `get_pattern_recommendations`
  - `get_developer_profile`
  - Potentially others that use `getDeveloperPatterns()`

## Proposed Solutions

### Solution 1: Add LIMIT to Database Queries (Immediate Fix)

**File**: `src/storage/sqlite-db.ts`

Add an optional `limit` parameter to `getDeveloperPatterns()`:

```typescript
getDeveloperPatterns(patternType?: string, limit?: number): DeveloperPattern[] {
    let query = 'SELECT * FROM developer_patterns';
    let params: any[] = [];

    if (patternType) {
      query += ' WHERE pattern_type = ?';
      params = [patternType];
    }

    query += ' ORDER BY frequency DESC, confidence DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    // ... rest of implementation
}
```

**Benefits**: Simple, backwards compatible, immediate fix

### Solution 2: Limit Examples Per Pattern

**File**: `src/mcp-server/tools/intelligence-tools.ts`

Truncate examples in responses:

```typescript
preferredPatterns: patterns.slice(0, 10).map(p => ({
  pattern: p.patternId,
  description: p.patternContent.description || 'Developer pattern',
  confidence: p.confidence,
  examples: p.examples.slice(0, 2).map(ex => {
    // Truncate long code examples
    const code = ex.code || '';
    return code.length > 200 ? code.substring(0, 200) + '...' : code;
  }),
  reasoning: `Used ${p.frequency} times`
})),
```

**Benefits**: Reduces token count significantly while keeping example context

### Solution 3: Add Pagination Support (Long-term)

Add pagination parameters to MCP tool schemas:

```typescript
inputSchema: {
  type: 'object',
  properties: {
    // ... existing properties
    limit: {
      type: 'number',
      description: 'Maximum number of patterns to return',
      default: 10,
      maximum: 50
    },
    offset: {
      type: 'number',
      description: 'Number of patterns to skip (for pagination)',
      default: 0
    }
  }
}
```

**Benefits**: Allows users to paginate through results, better API design

### Solution 4: Add Response Size Monitoring

**File**: `src/mcp-server/server.ts:119-144`

Add token estimation and truncation in the MCP server handler:

```typescript
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await this.routeToolCall(name, args);
    const resultJson = JSON.stringify(result, null, 2);

    // Rough token estimation (1 token ~= 4 characters)
    const estimatedTokens = resultJson.length / 4;

    if (estimatedTokens > 20000) {
      // Warn or truncate
      console.warn(`⚠️ Response size (${estimatedTokens} tokens) approaching limit`);
    }

    return {
      content: [{ type: 'text', text: resultJson }]
    };
  }
  // ... error handling
});
```

**Benefits**: Proactive monitoring, helps catch similar issues early

## Recommended Implementation Plan

1. **Immediate** (Priority 1): ✅ **COMPLETED**
   - ✅ Implement Solution 1 (LIMIT parameter)
   - ✅ Implement Solution 2 (Truncate examples)
   - ✅ Default limits: 50 patterns from DB, 10 in responses, 2 examples per pattern, 150 chars per example

2. **Short-term** (Priority 2):
   - Add pagination support (Solution 3)
   - Update MCP tool descriptions to mention limits

3. **Long-term** (Priority 3):
   - Add response size monitoring (Solution 4)
   - Create integration tests with large codebases to prevent regressions
   - Consider summarization for code examples instead of truncation

## Implementation Details (2025-11-12)

### Changes Made

1. **Database Layer** (`src/storage/sqlite-db.ts`)
   - Added optional `limit` parameter to `getDeveloperPatterns(patternType?, limit?)`
   - Default limit: 50 patterns (ordered by frequency and confidence)
   - Allows unlimited results if `limit=0` is explicitly passed

2. **Intelligence Tools** (`src/mcp-server/tools/intelligence-tools.ts`)
   - `getPatternRecommendations()`: Limits to 100 patterns, truncates examples to 2 per pattern (150 chars each)
   - `getDeveloperProfile()`: Limits to 50 patterns, same truncation rules
   - Added `truncateCode()` helper function for consistent truncation

3. **Pattern Engine** (`src/engines/pattern-engine.ts`)
   - `findRelevantPatterns()`: Limits to top 200 patterns before filtering
   - `getAllPatterns()`: Now accepts optional `limit` parameter
   - `getPatternsByType()`: Now accepts optional `limit` parameter
   - `getPatternStatistics()`: Limits to 100 patterns
   - `updatePatternUsageStats()`: Limits to 100 patterns

### Token Reduction Estimate

**Before**: ~58,000 tokens per response
**After**: ~2,000-5,000 tokens per response (estimated 90% reduction)

Calculation:
- 10 patterns (down from potentially 500+)
- 2 examples per pattern (down from 10-20)
- 150 chars per example (down from 1000+)
- Total: ~3,000 characters = ~750 tokens (vs 58,000 tokens)

### Testing Results

- ✅ All 120 tests passing
- ✅ TypeScript compilation successful
- ✅ Build successful (including Rust bindings)
- ✅ Backwards compatible (optional parameters)

## Testing Recommendations

1. **Test with Large Codebase**: Use a project with 1000+ files and verify token counts
2. **Test Limits**: Verify that limits are respected and pagination works
3. **Test Backwards Compatibility**: Ensure existing tools still work with default limits
4. **Monitor Token Usage**: Log response sizes for all MCP tools to identify other potential issues

## Related Files

- `src/storage/sqlite-db.ts` - Database queries
- `src/mcp-server/tools/intelligence-tools.ts` - Tool implementations
- `src/engines/pattern-engine.ts` - Pattern retrieval logic
- `src/mcp-server/server.ts` - MCP request handler

## Notes

- This issue was likely exacerbated by recent improvements to pattern extraction (PHP extractor, etc.)
- Token limits are enforced by Claude Code, not In-Memoria
- Other tools may have similar issues if they return large datasets without limits

---

# Additional Fix: Interactive Setup Password Input

## Problem

When entering the OpenAI API key during interactive setup (`in-memoria setup --interactive`), each character typed was displayed as both the character AND an asterisk (e.g., typing 'y' would show 'y*'). This also caused the setup wizard to skip the file watching configuration question.

## Root Cause

**Location**: `src/cli/interactive-setup.ts:440-443`

The password input handler was in raw terminal mode, but some terminals still echo typed characters. The code was writing an asterisk after each character without clearing the echoed character first:

```typescript
} else if (char >= ' ') {
  input += char;
  process.stdout.write('*');  // Writes '*' AFTER the echoed char
}
```

Result: User types 'y' → terminal echoes 'y' → code writes '*' → display shows 'y*'

## Solution

Clear the echoed character before writing the masking asterisk:

```typescript
} else if (char >= ' ') {
  input += char;
  // Clear any echoed character and write asterisk
  process.stdout.write('\b \b*');
}
```

This sequence:
1. `\b` - Move cursor back one position
2. ` ` - Overwrite echoed character with space
3. `\b` - Move cursor back again
4. `*` - Write the masking asterisk

## Files Changed

- `src/cli/interactive-setup.ts:444` - Fixed password character handling
- `CHANGELOG.md` - Documented the fix

## Impact

- Severity: Medium - Made interactive setup confusing and caused wizard to exit early
- Affected Feature: `in-memoria setup --interactive` command
- Affected Users: Anyone using interactive setup with enhanced vector embeddings
