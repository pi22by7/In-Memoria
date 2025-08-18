# Manual Integration Tests

This directory contains manual integration tests for development and debugging purposes.

## Test Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `test-simple.js` | Basic Rust analyzer functionality | `node tests/test-simple.js` |
| `test-learning.js` | Complete learning pipeline | `node tests/test-learning.js` |
| `test-learning-simple.js` | Simplified learning test | `node tests/test-learning-simple.js` |
| `test-learning-pipeline.js` | Full pipeline integration | `node tests/test-learning-pipeline.js` |
| `test-codebase-analysis.js` | Codebase analysis features | `node tests/test-codebase-analysis.js` |
| `test-complex-parsing.js` | Complex code parsing | `node tests/test-complex-parsing.js` |
| `test-documentation-generator.js` | Documentation generation | `node tests/test-documentation-generator.js` |
| `test-lang-detect.js` | Language detection | `node tests/test-lang-detect.js` |
| `test-tree-sitter-debug.js` | Tree-sitter parser debugging | `node tests/test-tree-sitter-debug.js` |
| `test-debug.js` | General debugging utilities | `node tests/test-debug.js` |

## Prerequisites

1. Build the project first:
   ```bash
   npm run build
   ```

2. Run individual tests:
   ```bash
   node tests/test-simple.js
   ```

## vs. Automated Tests

- **Manual Tests** (`tests/`): Integration tests for development, debugging, and manual verification
- **Automated Tests** (`src/__tests__/`): Unit tests that run with `npm test` for CI/CD

Both serve different purposes and should be maintained.