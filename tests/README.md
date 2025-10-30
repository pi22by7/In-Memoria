# Integration & Manual Tests

Tests for debugging, development, and end-to-end workflows.

## Quick Start

```bash
# ⚠️ Build first!
npm run build

# Run all tests
npm run test:integration

# Run specific test
node tests/test-simple.js
```

## What's Here

- **Manual tests** (`test-*.js`) - For debugging and development
- **Integration tests** (`integration/`) - End-to-end workflows

## Key Tests

| Test                             | Purpose                      |
| -------------------------------- | ---------------------------- |
| `test-simple.js`                 | Basic analyzer functionality |
| `test-learning.js`               | Learning pipeline            |
| `test-codebase-analysis.js`      | Code analysis                |
| `integration/test-mcp-client.js` | MCP protocol                 |

## Runner Options

```bash
node tests/run-all.js              # All tests
node tests/run-all.js integration  # Integration only
node tests/run-all.js manual       # Manual only
```

## Difference: `tests/` vs `src/__tests__/`

|               | `tests/` (here)            | `src/__tests__/` |
| ------------- | -------------------------- | ---------------- |
| **Type**      | Integration/Manual         | Unit tests       |
| **Framework** | Node.js scripts            | Vitest           |
| **Speed**     | Slow (5-30s)               | Fast (<1s)       |
| **Use**       | Debugging, workflows       | CI/CD, coverage  |
| **Run**       | `npm run test:integration` | `npm test`       |

**Simple rule**: Use `tests/` for debugging and end-to-end testing. Use `src/__tests__/` for automated unit tests.

See: **[TESTING.md](../docs/TESTING.md)** for the full guide.
