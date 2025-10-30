# Testing Strategy for In-Memoria

This document outlines the comprehensive testing approach for the In-Memoria project.

## Table of Contents

1. [Overview](#overview)
2. [Test Categories](#test-categories)
3. [Test Structure](#test-structure)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [Best Practices](#best-practices)
7. [CI/CD Integration](#cicd-integration)

## Overview

In-Memoria uses a multi-layered testing approach to ensure reliability, performance, and correctness:

- **Unit Tests**: Fast, isolated tests for individual components
- **Integration Tests**: Tests for component interactions and system behavior
- **Manual Tests**: Developer-driven exploratory and debugging tests
- **Performance Tests**: Benchmarks and load tests

## Test Categories

### 1. Unit Tests (`src/__tests__/*.test.ts`)

**Location**: `src/__tests__/`  
**Framework**: Vitest  
**Purpose**: Test individual functions, classes, and modules in isolation

**Categories**:

- **Core Services**: Database, storage, analysis engines
- **MCP Server**: Tool routing, request handling, validation
- **Utilities**: Helpers, formatters, validators
- **Type Safety**: Schema validation, type guards

**Characteristics**:

- ✅ Fast execution (< 1s per test)
- ✅ No external dependencies
- ✅ High coverage (target: 80%+)
- ✅ Runs in CI/CD pipeline

### 2. Integration Tests (`tests/integration/*.js`)

**Location**: `tests/integration/`  
**Framework**: Custom test harness  
**Purpose**: Test multi-component interactions and full workflows

**Categories**:

- **MCP Client-Server**: End-to-end MCP protocol tests
- **Learning Pipeline**: Complete codebase learning workflows
- **Error Handling**: System-wide error propagation
- **Server Lifecycle**: Startup, shutdown, restart scenarios

**Characteristics**:

- ⚠️ Slower execution (5-30s per test)
- ⚠️ May require real file system operations
- ⚠️ Tests actual service integration
- ✅ Runs in CI/CD pipeline (with timeouts)

### 3. Manual Tests (`tests/test-*.js`)

**Location**: `tests/`  
**Framework**: Custom scripts  
**Purpose**: Developer debugging, exploration, and verification

**Categories**:

- **Rust Analyzer**: Direct testing of Rust bindings
- **Language Detection**: Parser and language support
- **Complex Parsing**: Edge cases and unusual code structures
- **Performance**: Manual benchmarking and profiling
- **Debugging**: Isolated problem reproduction

**Characteristics**:

- ⏱️ Variable execution time
- 🔧 For development and debugging only
- 🚫 Not part of CI/CD
- ✅ Useful for rapid iteration

### 4. Performance Tests (`benchmarks/`)

**Location**: `benchmarks/`  
**Framework**: Custom benchmark suite  
**Purpose**: Performance regression detection and optimization

**Categories**:

- **Parsing Performance**: Large file parsing speed
- **Database Queries**: Query optimization benchmarks
- **Vector Operations**: Embedding and similarity search
- **Memory Usage**: Memory leak detection

**Characteristics**:

- 📊 Generates metrics and reports
- ⚠️ Long execution time
- 🔍 Run on-demand or nightly
- ✅ Tracks performance over time

## Test Structure

```
In-Memoria/
├── src/
│   └── __tests__/              # Unit tests (Vitest)
│       ├── setup.ts            # Global test setup
│       ├── helpers/
│       │   ├── test-utils.ts   # Test utilities
│       │   └── mock-data.ts    # Mock data generators
│       ├── *.test.ts           # Unit test files
│       └── __mocks__/          # Mock implementations
├── tests/                      # Manual & Integration tests
│   ├── README.md               # Manual test documentation
│   ├── run-all.js              # Test runner
│   ├── test-*.js               # Manual test scripts
│   └── integration/            # Integration test suite
│       ├── test-mcp-client.js
│       ├── test-server-lifecycle.js
│       └── test-error-handling.js
├── benchmarks/                 # Performance tests
│   ├── parsing-benchmark.js
│   └── database-benchmark.js
└── vitest.config.ts            # Vitest configuration
```

## Running Tests

### Quick Start

```bash
# Run all unit tests
npm test

# Run tests in watch mode (development)
npm test -- --watch

# Run specific test file
npm test -- sqlite-db.test.ts

# Run tests with coverage
npm test -- --coverage

# Run manual integration tests
npm run test:manual

# Run specific manual test
node tests/test-simple.js
```

### Detailed Commands

#### Unit Tests (Vitest)

```bash
# Run all unit tests
npm test

# Watch mode for active development
npm test -- --watch

# Run tests matching a pattern
npm test -- --grep "SQLiteDatabase"

# Run with coverage report
npm test -- --coverage

# Run tests in a specific file
npm test src/__tests__/sqlite-db.test.ts

# Run tests with UI (interactive)
npm test -- --ui

# Run tests with detailed output
npm test -- --reporter=verbose
```

#### Integration Tests

```bash
# Run all integration tests
npm run test:manual

# Run specific integration test
node tests/integration/test-mcp-client.js

# Run with debugging
NODE_OPTIONS='--inspect' node tests/integration/test-mcp-client.js
```

#### Manual Tests

```bash
# Run all manual tests sequentially
node tests/run-all.js

# Run specific manual test
node tests/test-simple.js
node tests/test-learning.js

# Run with debug output
DEBUG=* node tests/test-simple.js
```

#### Performance Tests

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark
node benchmarks/parsing-benchmark.js
```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestWorkspace } from "@tests/helpers/test-utils";

describe("ComponentName", () => {
  let workspace: ReturnType<typeof createTestWorkspace>;

  beforeEach(() => {
    // Setup test environment
    workspace = createTestWorkspace({
      "test.ts": 'export const hello = "world";',
    });
  });

  afterEach(() => {
    // Cleanup
    workspace.cleanup();
  });

  it("should perform expected behavior", () => {
    // Arrange
    const input = "test input";

    // Act
    const result = componentFunction(input);

    // Assert
    expect(result).toBe("expected output");
  });

  it("should handle edge cases", () => {
    // Test edge cases
    expect(() => componentFunction(null)).toThrow();
  });
});
```

### Integration Test Template

```javascript
#!/usr/bin/env node

import { CodeCartographerMCP } from "../dist/mcp-server/server.js";

async function testIntegration() {
  console.log("🧪 Testing integration scenario...\n");

  try {
    // Setup
    const server = new CodeCartographerMCP();
    await server.initialize();

    // Test
    const result = await server.handleRequest({
      method: "test",
      params: {},
    });

    // Verify
    if (!result) {
      throw new Error("Expected result to be defined");
    }

    console.log("✅ Integration test passed");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    process.exit(1);
  }
}

testIntegration();
```

## Best Practices

### General Guidelines

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Use descriptive test names
3. **AAA Pattern**: Arrange, Act, Assert
4. **One Assertion**: Focus on one behavior per test (when possible)
5. **Fast Tests**: Keep unit tests under 1 second
6. **Cleanup**: Always cleanup resources in `afterEach`

### Unit Tests

- ✅ **DO**: Mock external dependencies
- ✅ **DO**: Test edge cases and error conditions
- ✅ **DO**: Use test utilities from `helpers/`
- ❌ **DON'T**: Access real file system
- ❌ **DON'T**: Make network requests
- ❌ **DON'T**: Test implementation details

### Integration Tests

- ✅ **DO**: Test realistic workflows
- ✅ **DO**: Use temporary directories
- ✅ **DO**: Test error handling and recovery
- ⚠️ **CAREFUL**: Manage timeouts appropriately
- ⚠️ **CAREFUL**: Clean up all resources

### Manual Tests

- ✅ **DO**: Add clear console output
- ✅ **DO**: Document what the test verifies
- ✅ **DO**: Use for debugging and exploration
- ❌ **DON'T**: Rely on these for CI/CD

## Test Coverage Goals

| Category      | Target Coverage | Current |
| ------------- | --------------- | ------- |
| Core Services | 80%             | TBD     |
| MCP Server    | 75%             | TBD     |
| Storage Layer | 85%             | TBD     |
| Utilities     | 90%             | TBD     |
| **Overall**   | **80%**         | TBD     |

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm install
      - run: npm run build
      - run: npm test -- --coverage
      - run: npm run test:manual
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm test -- --run
```

## Troubleshooting

### Common Issues

**Problem**: Tests timeout  
**Solution**: Increase timeout in `vitest.config.ts` or individual test

**Problem**: Database lock errors  
**Solution**: Ensure proper cleanup in `afterEach` hooks

**Problem**: Flaky tests  
**Solution**: Check for race conditions, use `waitFor` helper

**Problem**: Mock not working  
**Solution**: Verify mock is defined before test imports

## Contributing

When contributing tests:

1. Follow the test structure and naming conventions
2. Add tests for new features
3. Ensure all tests pass before submitting PR
4. Update this document if adding new test categories
5. Maintain or improve test coverage

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [In-Memoria Architecture](./wiki/Architecture.md)

---

**Last Updated**: October 30, 2025  
**Maintainer**: In-Memoria Core Team
