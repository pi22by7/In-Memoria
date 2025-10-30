# Testing Guide

## Quick Start

```bash
# Run unit tests (fast, automated)
npm test

# Run with coverage
npm run test:coverage

# Run integration tests (slower, end-to-end)
npm run test:integration
```

## Test Structure: `tests/` vs `src/__tests__/`

### `src/__tests__/` - Unit Tests (Vitest)

**Purpose**: Fast, automated tests for individual components  
**Framework**: Vitest  
**Run with**: `npm test`

- ✅ Runs in CI/CD automatically
- ✅ Fast execution (milliseconds per test)
- ✅ Tests single functions/classes in isolation
- ✅ Mocked dependencies
- ✅ Coverage reporting

**Example**: Testing a single database method

```typescript
// src/__tests__/sqlite-db.test.ts
it('should store semantic concepts', () => {
  const concept = { id: 'test', name: 'TestClass', ... };
  database.insertSemanticConcept(concept);
  expect(database.getSemanticConcepts()).toHaveLength(1);
});
```

### `tests/` - Integration & Manual Tests

**Purpose**: Slower, manual tests for debugging and full workflows  
**Framework**: Custom Node.js scripts  
**Run with**: `npm run test:integration` or `node tests/test-*.js`

- 🔧 For development and debugging
- ⏱️ Slower execution (seconds per test)
- 🔄 Tests multiple components together
- 🎯 Real file system and databases
- 📊 Manual verification

**Example**: Testing the entire learning pipeline

```javascript
// tests/test-learning.js
const analyzer = new SemanticAnalyzer();
const concepts = await analyzer.learnFromCodebase("./src");
console.log(`Learned ${concepts.length} concepts`);
```

## When to Use Which?

| Use Case                      | Use This                     |
| ----------------------------- | ---------------------------- |
| Testing a function            | `src/__tests__/` (unit test) |
| Testing component interaction | `tests/` (integration test)  |
| CI/CD automation              | `src/__tests__/` (unit test) |
| Debugging a feature           | `tests/` (manual test)       |
| Quick feedback loop           | `src/__tests__/` (unit test) |
| End-to-end workflow           | `tests/` (integration test)  |

## Test Organization

```
In-Memoria/
├── src/__tests__/          # Unit tests (Vitest)
│   ├── setup.ts           # Global test setup
│   ├── helpers/           # Test utilities
│   └── *.test.ts          # Test files
│
└── tests/                 # Integration & manual tests
    ├── run-all.js         # Test runner
    ├── test-*.js          # Manual test scripts
    └── integration/       # Integration suite
```

## Common Commands

```bash
# Unit tests
npm test                    # Run once
npm test -- --watch         # Watch mode
npm run test:coverage       # With coverage

# Integration tests
npm run test:integration    # All integration tests
node tests/test-simple.js   # Single test

# Both
npm run test:all           # Run everything
```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("MyComponent", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something", () => {
    // Arrange
    const input = "test";

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Integration Test Template

```javascript
#!/usr/bin/env node

async function testFeature() {
  console.log("🧪 Testing feature...");

  try {
    // Test workflow
    const result = await doSomething();

    if (!result) throw new Error("Test failed");

    console.log("✅ Test passed");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testFeature();
```

## More Details

- **Comprehensive guide**: `docs/TESTING_STRATEGY.md`
- **Integration tests**: `tests/README.md`
