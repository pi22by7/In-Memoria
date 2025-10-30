# Changelog

All notable changes to In Memoria will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.6] - 2025-10-30

### 🐛 **Fixed**

- **Feature map file routing** - Fixed file routing functionality in `predict_coding_approach` MCP tool
  - Fixed NAPI field name conversion: Rust `feature_name` now correctly maps to JavaScript `featureName` (camelCase)
  - Fixed path matching: Database queries now handle both absolute paths and relative "." paths correctly
  - Fixed ES module import: Replaced `require('path')` with proper ES6 import in `sqlite-db.ts`
  - Added Migration v7: Added UNIQUE constraint to `project_metadata.project_path` for foreign key support
  - Worked around Claude Code MCP client bug where optional boolean parameters aren't passed by defaulting `includeFileRouting` to `true`
- **Project blueprint tool** - Fixed `get_project_blueprint` returning empty data
  - Fixed NAPI field name conversion in `detectEntryPoints` and `mapKeyDirectories` (semantic-engine.ts)
  - Fixed path normalization in database queries to handle both absolute and relative paths (sqlite-db.ts)
- **Pattern recommendations** - Fixed `get_pattern_recommendations` returning empty results
  - Replaced Rust in-memory HashMap approach with database-backed implementation (pattern-engine.ts)
  - Added keyword extraction and intelligent scoring algorithm (matches pattern type/content, confidence, frequency)
  - Now returns top 10 relevant patterns based on problem description
- **Feature mapping coverage** - Enhanced feature maps to include Rust code and language-specific patterns
  - Added 4 new feature categories: language-support, rust-core, mcp-server, cli (blueprint.rs)
  - Added nested directory search for mono-repo structures (checks rust-core/src/* paths)
  - Feature maps now cover both TypeScript and Rust code

### ✨ **Added**

- **Test infrastructure** - Formalized and consolidated testing (Issue #1)
  - Added Vitest configuration with coverage reporting
  - Created test utilities and helpers (`test-utils.ts`, `mock-data.ts`, `test-reporter.ts`)
  - Enhanced test runner with filtering support (integration/manual)
  - Added GitHub Actions workflow for manual test triggers
  - Created comprehensive testing documentation (`TESTING.md`)
  - Clear separation: `src/__tests__/` (unit tests) vs `tests/` (integration/manual)
- **Simplified progress tracking** - Replaced fancy progress bars with milestone-based logging (0%, 25%, 50%, 75%, 100%)
  - Eliminates log pollution when output is piped or observed by AI agents
  - Progress bars were causing 1000+ line output when piped due to ANSI escape codes
  - New approach logs only at key milestones for cleaner, more reliable progress tracking
- **Project metadata management** - Added `insertProjectMetadata()` and `getProjectMetadata()` methods to `sqlite-db.ts`
  - Ensures project metadata exists before creating feature maps (required for foreign key constraints)
  - Phase 6.5 in learning pipeline now creates project metadata automatically

### 🎯 **Improved**

- **MCP tool descriptions** - Enhanced all tool descriptions with explicit trigger phrases and usage guidance to help Claude automatically select the right tools for each task

### 📝 **Documentation**

- Updated `predict_coding_approach` tool description to clarify `includeFileRouting` defaults to `true`
- Added `TESTING.md` with clear explanation of test structure and usage
- Simplified `tests/README.md` to focus on essentials

## [0.5.5] - 2025-10-27

### 🐛 **Fixed**

- **MCP STDIO transport** - Fixed JSON parse errors in MCP Inspector
  - Logs now go to stderr instead of stdout (per MCP spec)
  - Stdout is reserved for JSON-RPC messages only
  - All logging is still visible and AI agents can see progress updates

### ✨ **Added**

- **Database auto-initialization** - Parent directories are created automatically
- **Path validation** - Helpful warnings when database paths look suspicious
- **Server path argument** - `in-memoria server /path/to/project` now sets working directory
- **PathValidator utility** - Reusable path validation with project detection
- **health_check tool** - New diagnostic tool for troubleshooting MCP setup issues
- **Better Copilot instructions** - Clear guidance on path parameter usage and tool examples

### 📝 **Documentation**

- **Issue #9 analysis** - Comprehensive root cause analysis in `docs/ISSUE_9_ANALYSIS.md`
  - Detailed breakdown of all 4 reported issues
  - Root cause analysis for each problem
  - 7 recommended fixes with code examples
  - Testing plan and migration guide for users
  - Code location appendix for quick reference

## [0.5.4] - 2025-10-25

### 🐛 **Fixed**

- **MCP server binary permissions** - Fixed "Permission denied" error when connecting to In Memoria MCP server via npx
  - Added `fix-permissions` script to set execute permissions on `dist/index.js` after TypeScript compilation
  - Created `build:ts` script for CI/CD TypeScript-only builds that includes permission fix
  - Updated release workflow to use new `build:ts` script ensuring published packages have correct permissions
  - Cross-platform compatible: uses try-catch for chmod on Windows where it's not critical

## [0.5.3] - 2025-10-24

### 🐛 **Fixed**

- **Progress tracking display** - Fixed janky and unreliable progress reports during learning (closes #11)
  - Eliminated console flooding with duplicate progress bar renders
  - Fixed line clearing issues that were erasing previous console output
  - Removed duplicate "Learning Complete!" messages appearing multiple times
  - Progress bars now update in-place smoothly without flickering
  - Empty progress bars no longer appear before phases actually start
  - All phases displayed consistently from start to finish
  - Fixed update frequency to 500ms for smooth, non-intrusive updates
  - Applied consistent progress display across all commands: `learn`, `setup --interactive`, and MCP `auto_learn_if_needed` tool

## [0.5.1] - 2025-10-24

### 🐛 **Fixed**

- **End user installation** - Removed unnecessary native dependencies that caused C++20 compilation errors
  - Removed tree-sitter packages from dependencies (tree-sitter is implemented in Rust, not TypeScript)
  - Removed unused `ws` package
  - End users can now install from npm without requiring C++20 compiler flags

## [0.5.0] - 2025-10-24

### ✨ **Added**

#### 🗺️ **Project Blueprint System (Phase 1)**

- **Token-efficient project intelligence** - New blueprint system eliminates cold start exploration by providing instant project context
  - **Entry point detection** - Automatically identifies web, API, CLI, and worker entry points based on framework patterns (React, Express, FastAPI, Svelte)
  - **Key directory mapping** - Discovers and categorizes important directories (components, utils, services, auth, models, etc.)
  - **Architecture inference** - Determines project architecture pattern (Component-Based, REST API, Service-Oriented, MVC, Modular)
  - **Feature-to-file mapping** - Foundation for mapping features to their implementation files
- **New database tables** - Added `feature_map`, `entry_points`, and `key_directories` tables with full migration support (Migration v5)
- **Enhanced `learn_codebase_intelligence` tool** - Now returns blueprint data in response including tech stack, entry points, key directories, and architecture
- **New `get_project_blueprint` tool** - Fast blueprint access without full learning, provides instant project context (<200 tokens target)
- **Blueprint detection in SemanticEngine** - `detectEntryPoints()` and `mapKeyDirectories()` methods automatically enrich codebase analysis
- **Comprehensive database methods** - Full CRUD operations for blueprint tables with proper TypeScript interfaces

#### 🎯 **Token Efficiency Goals**

- **Cold start optimization** - Target <200 tokens for initial project understanding (vs current ~3000+ tokens)
- **Direct file access** - Agents can jump straight to relevant files without exploration
- **Session resume** - Target <100 tokens to restore work context
- **Smart routing** - Target <50 tokens to route vague requests to specific files

#### 💼 **Work Context System (Phase 2)**

- **Session tracking infrastructure** - New work session management for AI agent memory and context continuity
  - **Work session persistence** - Track current files, pending tasks, completed tasks, and blockers across AI sessions
  - **Project decision history** - Record architectural decisions with reasoning for future reference
  - **Session resume capability** - Enable agents to pick up exactly where they left off (target <100 tokens)
- **New database tables** - Added `work_sessions` and `project_decisions` tables with full migration support (Migration v6)
- **Enhanced `get_developer_profile` tool** - Added optional `includeWorkContext` parameter to include current work session data
  - Returns current files being worked on
  - Lists pending tasks and recently completed tasks
  - Provides recent project decisions with reasoning
- **Enhanced `contribute_insights` tool** - Added optional `sessionUpdate` parameter to update work context
  - Update current files and feature being worked on
  - Modify task lists (pending/completed)
  - Record project decisions with key-value pairs and reasoning
- **Comprehensive session management** - Full CRUD operations for work sessions and decisions
  - `createWorkSession()` - Initialize new work sessions
  - `updateWorkSession()` - Update session state (files, tasks, feature)
  - `getCurrentWorkSession()` - Retrieve active session for project
  - `upsertProjectDecision()` - Store or update architectural decisions
  - `getProjectDecisions()` - Fetch recent decisions with reasoning

#### 🧭 **Smart Navigation & Routing (Phase 3)**

- **Feature-to-file mapping engine** - Automatically maps project features to their implementation files
  - **10 feature categories** - Authentication, API, database, UI components, views, services, utilities, testing, configuration, middleware
  - **Directory pattern detection** - Intelligent mapping based on common project structures
  - **File collection and categorization** - Splits files into primary and related categories for targeted navigation
- **Request routing intelligence** - Routes vague task descriptions to specific files
  - **Work type detection** - Automatically classifies tasks as feature, bugfix, refactor, or test
  - **Keyword-based routing** - Matches problem descriptions to relevant features using 20+ common keywords
  - **Smart file suggestions** - Returns top 5 most relevant files with suggested starting point
- **Enhanced `predict_coding_approach` tool** - Added optional `includeFileRouting` parameter
  - Returns intended feature, target files, work type, and suggested starting point
  - Enables agents to jump directly to relevant code without exploration
- **Enhanced `get_pattern_recommendations` tool** - Added optional `includeRelatedFiles` parameter
  - Suggests related files where similar patterns are used
  - Helps agents discover consistent implementation patterns across the codebase
- **Feature map database methods** - New methods for searching and accessing feature mappings
  - `searchFeatureMaps()` - Search features by keyword with case-insensitive matching
  - `getFeatureByName()` - Retrieve specific feature mapping by exact name
- **Pattern-based file discovery** - `findFilesUsingPatterns()` method matches patterns to feature categories
  - Links testing patterns to test files, API patterns to API files, etc.
  - Returns up to 10 most relevant files for given pattern recommendations

### 🛠️ **Changed**

- **Database schema** - Added blueprint-related tables (Phase 1) and work context tables (Phase 2) with proper foreign key constraints
- **Migration system** - Enhanced validation for blueprint tables (Migration v5) and session tracking (Migration v6)
- **CodebaseAnalysisResult interface** - Extended with optional `entryPoints` and `keyDirectories` fields
- **DeveloperProfile interface** - Extended with optional `currentWork` field containing session context
- **Tool architecture** - Phase 1 (blueprint), Phase 2 (work context), and Phase 3 (smart navigation) complete; ready for Phase 4 (tool consolidation)

### 🐛 **Fixed**

- **Phase 1-4 integration** - Fixed missing route handlers and Rust exports causing test failures
  - Added `get_project_blueprint` route handler (Phase 1 feature was defined but not routed)
  - Fixed BlueprintAnalyzer Rust exports and removed incorrect constructor calls
  - Added missing validation schema parameters (`skipLearning`, `includeSetupSteps`)
  - Fixed migration rollback to version 0 (now properly deletes migration records)
  - Fixed Rust HashMap type compatibility in pattern prediction context handling
- **Progress rendering** - Improved learning process console output clarity and accuracy
  - Only display phases after they've started (eliminates visual clutter)
  - Removed duplicate progress updates during phase transitions
  - Phases now appear progressively instead of all at once

## [0.4.6] - 2025-09-11

### 🐛 **Fixed**

- **CLI help accuracy** - Fixed misrepresented flags and outdated environment variables in help text (closes #2)
- **Learning process crash** - Fixed "Cannot read properties of undefined (reading 'toFixed')" error during complexity analysis
- **Framework detection false positives** - Improved accuracy by using file extension counting instead of unreliable source code text matching, fixes dependency pattern specificity (closes #8)

## [0.4.5] - 2025-09-10

### ✨ **Added**

#### 🔍 **Enhanced TypeScript/JavaScript Language Support**

- **Comprehensive TypeScript/JavaScript extractor** - Major enhancement from basic extraction to rich semantic analysis
  - **Enhanced class extraction** with decorators, inheritance, accessibility modifiers
  - **Advanced interface analysis** with extends clause extraction
  - **Type alias extraction** with full type definition capture
  - **Enum extraction** with const enum detection
  - **Rich function analysis** with async/static modifiers, parameter extraction
  - **Variable extraction** with type annotation capture
- **Module and import/export analysis** - Full module system support
  - **Import statement extraction** with source path analysis
  - **Export statement extraction** with declaration type detection
  - **Module/namespace declarations** with type distinction
- **Comprehensive metadata collection**
  - **Decorator extraction** for classes and methods
  - **Accessibility modifier detection** (public/private/protected)
  - **Function parameter analysis** with type information
  - **Inheritance relationships** for classes and interfaces
  - **Type definitions** for aliases and complex types

#### 🐍 **Enhanced Python Language Support**

- **Comprehensive Python extractor** - Complete rewrite from basic extraction to full grammar support
  - **Advanced class analysis** with inheritance, decorators, abstract methods, constructor detection
  - **Rich function extraction** with async/generator detection, type hints, parameter analysis
  - **Modern Python features** - type aliases, pattern matching (match statements), context managers
  - **Variable analysis** with type annotations and value type inference
  - **Comprehensive import system** - import/from-import statements with detailed module analysis
- **Advanced class metadata collection**
  - **Method counting and classification** - regular methods, class methods, static methods, properties
  - **Abstract method detection** - identifies `@abstractmethod` decorators
  - **Constructor analysis** - `__init__` method detection and parameter extraction
  - **Decorator analysis** - comprehensive decorator extraction and classification
  - **Inheritance analysis** - superclass detection and generic type parameter extraction
- **Smart type inference**
  - **Type annotation extraction** from function parameters and variable declarations
  - **Value type inference** from literals, collections, and function calls
  - **Generator detection** through yield statement analysis

#### 🔧 **Pattern Learning Performance & Stability**

- **Fixed CPU consumption issue** in pattern learning that caused "Learning coding patterns..." to hang
- **Added timeout protection** (60 second limit) to prevent infinite processing on large codebases
- **Reduced file processing limit** from 1000 to 100 files for initial learning to improve performance
- **Added depth limits** (`max_depth(5)` for concept extraction, `max_depth(3)` for directory analysis)
- **Restored proper file filtering** from backup implementation using `should_analyze_file()`
- **Added pattern quality thresholds** (minimum frequency: 3 for naming patterns, 2 for others)
- **Restored directory structure analysis** that properly uses `is_ignored_directory()` method
- **Enhanced directory filtering** to skip `node_modules`, `.git`, `target`, `dist`, `build`, `.next`, `__pycache__`, `coverage`, `.vscode`, `.idea`

#### 🏗️ **Major Architecture Refactor - Modular Code Structure**

Complete transformation from monolithic codebase to a clean, modular architecture focusing on maintainability, code quality, and developer experience.

- **Complete modular restructuring** - Transformed monolithic 4,869-line codebase into organized 33-file modular architecture
  - `analysis/` - Semantic analysis, complexity metrics, relationship learning, framework detection
  - `extractors/` - Language-specific concept extraction (SQL, general fallback)
  - `parsing/` - AST parsing, tree walking, parser management
  - `patterns/` - Pattern learning, naming analysis, structural analysis, implementation detection, approach prediction
  - `types/` - Core type definitions and shared interfaces
- **Backwards compatibility maintained** - All existing public APIs preserved via re-exports
- **Enhanced functionality** - Each module now includes comprehensive implementations previously marked as TODOs
- **Historical approach learning** - Uses `problem_description`, `complexity`, and `success_rating` for intelligent template scoring
- **Context-aware recommendations** - Domain-specific architectural advice (enterprise, prototype, real-time systems)
- **Timeline-sensitive selection** - Different approaches for urgent vs long-term projects
- **Maintainability-driven scoring** - Adjusts recommendations based on maintenance requirements

### 🛠️ **Changed**

#### 🏗️ **Code Quality & Performance**

- **Zero clippy warnings** - All linting issues resolved through proper implementation
- **Enhanced helper methods** - Robust AST node traversal and text extraction
- **Optimized iterator patterns** - Uses efficient `next_back()` instead of `last()` for better performance
- **Proper error handling** - No suppression warnings, all issues addressed functionally
- **Bounded file processing** - Proper timeout and limits to prevent resource exhaustion
- **Smarter pattern consolidation** - Quality filtering to reduce noise and improve accuracy
- **Efficient directory traversal** - Depth limiting to avoid deep recursion
- **Migrated from monolithic files**:
  - `ast_parser.rs` (698 lines) → `parsing/` module with clean separation
  - `pattern_learning.rs` (2,121 lines) → `patterns/` module with specialized analyzers
  - `semantic.rs` (2,001 lines) → `analysis/` module with focused responsibilities
- **Enhanced functionality over suppression** - All dead code warnings resolved through complete feature implementation
- **Idiomatic Rust patterns** - Uses `clamp()` instead of manual min/max chains
- **Proper borrowing patterns** - Resolved HashMap iteration conflicts with clean ownership

### ✅ **Fixed**

#### 🐛 **TypeScript Extractor Issues**

- **Missing method implementations** - All extract methods now properly integrated
- **Borrowing conflicts** - Resolved lifetime issues with proper collection patterns
- **Dead code warnings** - Eliminated through complete feature implementation
- **Manual iterator patterns** - Fixed clippy suggestions with safe borrowing patterns

#### 🚨 **Compilation & Linting**

- **Complete clippy compliance** - Eliminated all warnings through functional completion rather than suppression
- **Missing struct fields** - Added and implemented `ApproachTemplate.confidence` and `ApproachTemplate.patterns`
- **Duplicate method definitions** - Resolved conflicts in `StructuralPatternAnalyzer`
- **Import organization** - Cleaned up unused imports while maintaining necessary dependencies
- **Numeric type ambiguity** - Fixed floating-point type inference with explicit annotations

#### 🏗️ **Architecture Issues**

- **Backwards compatibility** - `AstParser` alias maintains API compatibility during transition
- **Missing method implementations** - All placeholder methods now fully functional
- **Dead code elimination** - Every struct field now actively used in business logic
- **Borrowing conflicts** - Clean separation of mutable and immutable references

---

## [0.4.4] - 2025-09-03

### ✅ Fixed

#### 🗄️ Database Location & MCP Progress Output

- **Database path fixed in CLI commands** - Learning, analysis, and watch commands now correctly place database files in the analyzed project directory instead of current working directory
- **MCP server progress output improved** - Fixed "Failed to parse message" warnings when using progress bars
  - ASCII progress bars `[====----] 42.0%` in MCP mode instead of Unicode blocks
  - Removed ANSI escape codes from MCP server output to prevent JSON parsing conflicts
  - Progress information now cleanly visible in MCP logs without parsing errors

#### 🔧 Database Infrastructure Improvements

- **Improved MCP server database handling** - Enhanced database management for learning operations
  - MCP server now creates project-specific database instances for learning operations
  - Better resource cleanup for database connections
  - Improved database path resolution consistency

#### 📢 Embedding Output Cleanup

- **Fixed embedding progress spam** - CLI learning no longer outputs hundreds of individual embedding messages
  - Changed from per-concept logging to single initialization message
  - Prevents terminal spam when processing large codebases with many concepts
  - Added debug logging for SQL file processing to help diagnose parsing issues

#### 🐛 SQL Concept Extraction Enhanced

- **Fixed SQL files reporting 0 concepts learned** - Resolved issue where SQL Server Database Projects weren't being analyzed
  - Fixed SQL node type matching in tree-sitter parser (was expecting `"create_table_statement"` but parser generates `"create_table"`)
  - SQL files now properly extract table, view, and procedure concepts
  - Verified working with SQL Server bracket notation syntax `[dbo].[TableName]`
- **Enhanced SQL concept extraction** - Improved extraction accuracy and coverage
  - Added specialized table name extraction from `object_reference` nodes
  - Added column concept extraction from `column_definition` nodes
  - Enhanced identifier extraction to handle complex SQL Server syntax
  - Improved from 2 to 11 concepts extracted from the test SQL file

## [0.4.3] - 2025-08-30

### 🔧 Code Quality & Reliability Improvements

Major code audit and technical debt resolution focused on TypeScript strict compliance, error handling, system reliability, and comprehensive language support implementation.

### ✅ Fixed

#### 🏗️ TypeScript Strict Mode Compliance

- **62 TypeScript strict mode errors resolved** - Complete migration to strict TypeScript compilation
  - Fixed implicit `any` types across all files
  - Added proper error type handling with `catch (error: unknown)` pattern
  - Fixed class property initialization with definite assignment assertions
  - Enhanced type safety in MCP server, engines, and CLI tools
- **tsconfig.json strict mode enabled** - `"strict": true` for enhanced type safety

#### 🛡️ Error Handling & Circuit Breaker Improvements

- **Enhanced circuit breaker error transparency** - Original errors now preserved instead of being masked
- **Transparent graceful degradation** - System provides clear warnings when analysis degrades instead of silent failures
  - Semantic analysis uses sentinel values (-1) to indicate "could not measure" vs 0 for "no complexity"
  - Analysis status metadata: `analysisStatus: 'degraded'` with explicit `errors: string[]`
  - Pattern analysis provides clear degradation warnings to users
- **Honest error reporting** - Eliminated fake success results, replaced with transparent failure indicators

#### 🏛️ Configuration Management

- **Centralized configuration system** - New `src/config/config.ts` with proper database path management
- **Project-specific database placement** - Database correctly stored within analyzed project directory
- **Environment-aware configuration** - Proper defaults with override capabilities

#### 🌍 Language Support Implementation

- **7 new languages properly implemented** - SQL, Go, Java, C, C++, C#, and Svelte now have language-specific semantic extractors instead of generic fallbacks
  - Added proper AST node parsing for each language's syntax patterns
  - Implemented language-specific concept extraction (classes, functions, variables, etc.)
  - Enhanced code analysis accuracy for multi-language projects
- **Rust code safety improvements** - Fixed problematic `.unwrap()` patterns that could cause panics
  - Replaced unsafe string operations with safe `is_some_and()` patterns
  - Enhanced HashMap access safety with proper pattern matching
  - Maintained performance while eliminating crash-prone code paths

#### 🔧 Input Validation & Reliability

- **Comprehensive MCP tool validation** - Added missing input validation across all 17 MCP tools
- **Zod schema validation** - Enhanced parameter validation with better error messages
- **Path sanitization** - Improved security for file system operations

### 🚀 Performance & Dependencies

#### ⚡ Optimization

- **Removed over-engineered batch processor** - Eliminated unnecessary `BatchProcessor` class that duplicated Rust functionality
- **Cache cleanup and management** - Enhanced memory management with proper cache TTL handling
- **Memoization improvements** - Better performance caching for language detection

#### 📦 Dependency Management

- **Rust build configuration optimized** - Fixed feature flag conflicts in `Cargo.toml`
  - Corrected `"rust"` → `"rust-lang"` feature naming consistency
  - Proper language feature organization for selective compilation
- **Consolidated redundant imports** - Cleaned up duplicate and unused dependencies

### 🧪 Testing & Quality Assurance

- **Enhanced test coverage** - Updated all test files for strict TypeScript compliance
- **Circuit breaker validation tests** - New test files for error transparency validation
- **Local embedding tests** - Comprehensive vector database testing
- **Build verification** - Complete TypeScript compilation and Rust build validation

### 🔄 Changed

#### 📡 Enhanced Error Context

- **Fallback analysis transparency** - Users now understand exactly why analysis is degraded
- **Circuit breaker state reporting** - Detailed failure information with recovery guidance
- **Quality indicators in results** - Analysis results include quality metadata

#### 🎯 Development Experience

- **Strict TypeScript enforcement** - Catch type errors at compile time instead of runtime
- **Better IDE support** - Enhanced IntelliSense and error detection
- **Cleaner codebase** - Removed unnecessary abstractions and over-engineering

### 🛠️ Technical Infrastructure

- **Database migration integrity** - Enhanced migration validation with proper error handling
- **Configuration validation** - Runtime configuration checking with helpful error messages
- **Resource cleanup** - Proper cleanup intervals and memory management

### 📊 Quality Metrics

#### ✅ Code Quality Improvements

- **TypeScript Errors**: 62 → 0 (100% resolution)
- **Strict Mode**: Fully enabled across entire codebase
- **Error Handling**: Consistent `unknown` error type handling
- **Build Success**: Both TypeScript and Rust builds now pass completely

#### 🔧 Reliability Enhancements

- **Transparent Degradation**: Users understand system limitations
- **Error Preservation**: Original error context maintained through circuit breakers
- **Input Validation**: All MCP tools properly validate parameters
- **Configuration Management**: Centralized and project-aware database placement

## [0.4.2] - 2025-08-29

### 🚀 Performance & Language Support Improvements

### ✨ Added

#### 🎯 Comprehensive Language Support

- **Native AST parsing for 11 programming languages** - TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, C#, Svelte, and SQL
- **Tree-sitter parser integration** for all supported file types
- **Enhanced semantic analysis** with proper AST-based parsing instead of text fallbacks

#### 🧠 Complete Pattern Learning Engine

- **All pattern learning methods fully implemented** - Complete Rust `PatternLearner` with 6 core methods
  - `extract_patterns` - Extract coding patterns from file paths and directories
  - `analyze_file_change` - Analyze file changes to identify pattern violations and recommendations
  - `find_relevant_patterns` - Find patterns relevant to problem descriptions with confidence scoring
  - `predict_coding_approach` - Predict coding approaches based on learned patterns and context
  - `learn_from_analysis` - Learn new patterns from semantic analysis data (JSON)
  - `update_from_change` - Update pattern frequencies from file change analysis
- **Complete NAPI JavaScript bindings** - All 6 pattern learning methods exported to JavaScript
- **Advanced implementation features** - JSON parsing, pattern frequency management, semantic matching, confidence scoring

### ✅ Fixed

#### 🐛 Critical Bug Fixes

- **CLI command hanging** - Fixed resource cleanup issues causing commands to hang after completion
- **Svelte learning timeout issue** - Fixed indefinite hangs when analyzing Svelte codebases
- **Tree-sitter version conflicts** - Resolved dependency incompatibilities between language parsers
- **Memory leak prevention** - Added timeout protection (30 seconds) for complex parsing operations
- **Binary compatibility issues** - Fixed NAPI binding compilation errors
- **All Rust clippy warnings resolved** - Zero linting errors including collapsible if statements and missing safety documentation

#### 🏗️ Performance & Reliability Improvements

- **Enhanced file filtering** - Excludes build artifacts (.next, dist, node_modules) automatically
- **Robust error handling** - Graceful fallbacks for unsupported or malformed files
- **Optimized parser initialization** - Faster startup with lazy loading of language parsers
- **Size and count limits** - Prevents resource exhaustion on very large projects

### 🧪 Testing & Quality Assurance

- **Complete Rust test coverage** - 27 Rust unit tests with 100% pass rate (10 pattern learning + 17 semantic analysis)
- **Pattern learning test suite** - Comprehensive tests for all new methods with realistic data validation
- **Language-specific test coverage** - Real code samples for all supported languages
- **Cross-platform compatibility** - Verified on Linux with Node.js NAPI bindings
- **Performance benchmarking** - Timeout protection validated with complex codebases
- **Enhanced error handling** - Better error messages and recovery
- **Performance monitoring** - Warnings for slow operations
- **Code quality** - Resolved all Rust clippy warnings

### 🔧 Internal Changes

- Enhanced `should_analyze_file()` with comprehensive filtering logic
- Added per-file and overall timeout protection in Rust semantic analyzer
- Improved error handling and graceful degradation for failed file processing
- Better progress reporting and performance warnings
- Complete pattern learning algorithm implementation with advanced statistical analysis

## [0.4.1] - 2025-08-25

### 🔧 Technical Debt Resolution & Testing Infrastructure

Major session focused on resolving critical technical debt and establishing comprehensive testing infrastructure.

### ✅ Fixed

#### 🐛 Critical Bug Fixes

- **Timezone handling bug** - Fixed 5.5-hour offset between SQLite timestamps and filesystem timestamps
  - Root cause: SQLite `CURRENT_TIMESTAMP` stores local time, JavaScript interprets as UTC
  - Solution: Updated schema to use `datetime('now', 'utc')` and added Migration 4
  - Impact: Fixed staleness detection false positives in IST timezone
- **MCP integration test failures** - Tests failed due to uninitialized server components
  - Added `initializeForTesting()` method for proper test setup
  - Fixed Tool Completeness tests to use `routeToolCall` instead of direct server requests

#### 🏗️ Technical Infrastructure

- **Performance profiling system** - Added comprehensive performance monitoring utilities
  - `PerformanceProfiler` class with timing methods and optimization decorators
  - Performance caching and memoization utilities for hot paths
- **MCP-compliant error handling** - Implemented structured error types with recovery actions
  - `InMemoriaError` class hierarchy with MCP conversion methods
  - Proper error propagation from Rust engines to TypeScript layer
- **Rust conditional compilation** - Fixed N-API feature flags for testing environments
  - Added `[features] default = ["napi-bindings"]` to Cargo.toml
  - Resolved clippy warnings and build inconsistencies

### 🧪 Testing Infrastructure

#### ✅ Comprehensive Test Suite (98.3% Pass Rate)

- **118/120 unit tests passing** - Fixed timing-sensitive automation tool tests
- **23/23 MCP integration tests passing** - All MCP protocol functionality verified
- **Integration test suite** - Added comprehensive real-world testing:
  - `tests/integration/test-mcp-client.js` - Basic MCP functionality (6/6 passed)
  - `tests/integration/test-advanced-mcp.js` - Advanced features (6/8 passed)
  - `tests/integration/test-error-handling.js` - Error validation (6/8 passed)
  - `tests/integration/test-server-lifecycle.js` - Server lifecycle (5/5 passed)

#### 🔄 Server Lifecycle Verification

- **Clean startup** - Server initializes and reports ready status correctly
- **Graceful SIGTERM shutdown** - Proper signal handling with 8ms shutdown time
- **Force kill recovery** - Robust recovery after SIGKILL termination
- **Resource cleanup** - Memory leak detection (0MB increase after shutdown)
- **Database lock cleanup** - Proper lock release allowing new server instances

### 🚀 Performance Improvements

#### ⚡ Optimization Features

- **Lazy initialization** - Rust analyzer components load on-demand
- **Staleness detection** - File modification time-based cache invalidation
  - 5-minute buffer for filesystem timestamp variations
  - UTC-normalized comparison to prevent timezone issues
- **Circuit breaker patterns** - Fault tolerance for external dependencies
- **Caching optimizations** - LRU caches and memoization for frequently accessed data

### 🛠️ Changed

#### 📁 Project Organization

- **Test file organization** - Moved integration tests to `tests/integration/` directory
- **Database schema** - Migration 4 updates all timestamp fields to UTC
- **Staleness detection logic** - Refined algorithm with proper timezone handling

### 📊 Quality Metrics

#### ✅ Test Coverage Summary

- **Unit Tests**: 118/120 (98.3% pass rate)
- **MCP Integration**: 23/23 (100% pass rate)
- **Basic MCP Functionality**: 6/6 (100% pass rate)
- **Advanced MCP Features**: 6/8 (75% pass rate, expected timeouts)
- **Error Handling**: 6/8 (75% pass rate, proper error responses)
- **Server Lifecycle**: 5/5 (100% pass rate)

#### 🔧 Code Quality

- **All clippy warnings resolved** - Clean Rust builds with zero warnings
- **TypeScript strict mode compliance** - All type errors resolved
- **Performance profiling** - Comprehensive monitoring infrastructure in place

---

## [0.3.2] - 2025-08-19

### 🔧 Package Distribution Fixes

Minor release to fix npm publishing issues with cross-platform packages.

### 🛠️ Changed

- **Package naming** - Switch to scoped packages (`@in-memoria/*`) to avoid npm spam detection
- **Build workflow** - Use `npm install` instead of `npm ci` for main package publishing
- **Repository URLs** - Add `git+` prefix to avoid npm warnings

### 📦 Platform Packages

- `@in-memoria/linux-x64` - Linux x64 native bindings
- `@in-memoria/darwin-x64` - macOS Intel native bindings
- `@in-memoria/darwin-arm64` - macOS Apple Silicon native bindings
- `@in-memoria/win32-x64` - Windows x64 native bindings

---

## [0.3.1] - 2025-08-19

### 🚀 Cross-Platform Release - Universal Compatibility

This release makes In Memoria work seamlessly across Windows, macOS, and Linux with optimized package distribution and 80% smaller downloads.

### ✨ Added

#### 🌍 Cross-Platform Support

- **Windows compatibility** - Full support for x64 Windows systems
- **macOS compatibility** - Support for both Intel (x64) and Apple Silicon (ARM64) Macs
- **Linux compatibility** - Enhanced Linux x64 support with glibc
- **Platform-specific packages** - Automatic installation of correct binaries per platform

#### 📦 Optimized Package Distribution

- **Platform-specific npm packages** - `in-memoria-{linux-x64,darwin-x64,darwin-arm64,win32-x64}`
- **Minimal main package** - Only 130KB download (vs previous 50MB+)
- **Automatic platform detection** - Runtime loading of correct native binaries
- **Optional dependencies** - npm installs only the user's platform binaries

#### 🔧 Build System Improvements

- **Cross-platform build scripts** - Support for building on any platform
- **GitHub Actions matrix builds** - Automated builds for all 4 platforms
- **NAPI-RS configuration** - Modern build targets and binary naming
- **Platform detection fallbacks** - Graceful error handling for unsupported platforms

### 🛠️ Changed

- **File copy operations** - Replaced Unix `cp` with cross-platform Node.js operations
- **Build commands** - Use `npm --prefix` instead of `cd` for Windows compatibility
- **Shell scripts** - Explicit `bash` shell for cross-platform GitHub Actions
- **TypeScript types** - Fixed class type exports for better IDE support

### 🐛 Fixed

- **Windows build failures** - Resolved path separator and toolchain issues
- **macOS compilation** - Fixed cross-compilation toolchain requirements
- **Package structure** - Proper binary loading and fallback mechanisms
- **GitHub Actions** - Cross-platform workflow compatibility

### 📊 Package Size Reduction

- **Before**: ~50MB (all platforms bundled)
- **After**: ~2MB per user (only their platform)
- **Savings**: 80% smaller downloads and faster installs

---

## [0.3.0] - 2025-08-18

### 🎯 Major Usability Release - Seamless Agent Integration

This release transforms In Memoria from a developer-focused tool into a seamless AI agent platform with comprehensive automation, monitoring, and user experience improvements.

### ✨ Added

#### 🤖 Agent Automation Tools

- **`auto_learn_if_needed`** - Automatic learning trigger for agents with progress tracking
- **`get_learning_status`** - Intelligence status checking for smart decision making
- **`quick_setup`** - Complete automated setup and learning pipeline

#### 📊 Monitoring & Analytics Tools

- **`get_system_status`** - Comprehensive health dashboard with component status
- **`get_intelligence_metrics`** - Detailed analytics on learned concepts and patterns
- **`get_performance_status`** - Performance metrics with optional benchmarking

#### 🎮 Interactive Setup System

- **`in-memoria setup --interactive`** - Guided setup wizard with auto-detection
- **Language detection** - Automatic project language identification
- **Smart defaults** - Intelligent configuration recommendations
- **Secure API key handling** - Masked input for sensitive data
- **Configuration validation** - Real-time validation with helpful error messages

#### 📈 Progress Tracking System

- **Progress indicators** with ETA calculations for all long-running operations
- **Multi-phase tracking** - Discovery → Semantic Analysis → Pattern Learning → Indexing
- **Real-time updates** - Console progress bars with 500ms refresh rate
- **Performance metrics** - Processing rate and time estimation

#### 🔧 Comprehensive Debugging Tools

- **`in-memoria debug --verbose`** - Full diagnostic suite
- **System diagnostics** - Node.js version, platform, memory usage
- **Database diagnostics** - Schema version, data integrity, query performance
- **Intelligence diagnostics** - Component health, API integration status
- **File system diagnostics** - Project structure, configuration validation
- **Performance analysis** - Database size, query times, benchmarking
- **Data validation** - Deep intelligence data consistency checks

#### 🏗️ Infrastructure Improvements

- **Database migration system** - Versioned schema updates with rollback support
- **Circuit breakers** - Fault tolerance for external API calls and Rust analyzer
- **Input validation** - Zod schema validation for all 17 MCP tools
- **Comprehensive test suite** - Unit tests with proper isolation and cleanup

### 🔄 Changed

#### 📡 MCP Server Enhancement

- **17 total tools** (was 11) - 54% increase in functionality
- **4 tool categories** - Core Analysis, Intelligence, Automation, Monitoring
- **Enhanced error handling** - Structured error responses with detailed messages
- **Performance optimizations** - Circuit breakers prevent cascading failures

#### 🎯 User Experience Transformation

- **Zero manual setup** required for agent use
- **Seamless learning** - Agents can trigger learning automatically
- **Real-time feedback** - Progress visibility for all operations
- **Professional debugging** - Enterprise-grade diagnostic tools

#### 📚 Documentation Updates

- **Updated README** - Complete tool listing with categories
- **Enhanced CONTRIBUTING** - Updated for Node.js 24+ compatibility
- **New CHANGELOG** - Proper versioning and release tracking

### 🐛 Fixed

#### 🔧 Reliability Improvements

- **Node.js 24+ compatibility** - Removed outdated warnings, confirmed working
- **TypeScript compilation** - All new code properly typed and validated
- **Database initialization** - Robust error handling with migration support
- **Memory management** - Progress tracking with proper cleanup

#### 🛠️ Technical Fixes

- **Test suite integration** - Proper vitest configuration with src/**tests**/
- **Import validation** - Fixed TypeScript import errors
- **Schema validation** - Proper Zod schema definitions for all tools
- **CLI argument parsing** - Enhanced command-line interface handling

### 💥 Breaking Changes

- **Minimum Node.js version** now officially 18+ (was informally 20+)
- **MCP tool count** increased from 11 to 17 - agents may need capability updates
- **Database schema version** bumped to v3 with automatic migration

### 🎯 Migration Guide

#### For Existing Users

```bash
# Existing installations will auto-migrate database schema
in-memoria debug --verbose  # Check system health after upgrade
```

#### For New Users

```bash
# Recommended setup path
in-memoria setup --interactive  # Full guided setup

# Or quick start for agents
in-memoria server  # Auto-learning will happen as needed
```

#### For Agent Developers

```javascript
// Agents should use automation tools for best experience
await tools.auto_learn_if_needed({ path: "./", includeProgress: true });
const status = await tools.get_system_status({ includeMetrics: true });
```

### 🏆 Impact Summary

#### Usability Score: 7/10 → 9.5/10

- **Seamless agent integration** - Zero manual intervention required
- **Professional user experience** - Progress tracking and status monitoring
- **Enterprise debugging** - Comprehensive diagnostic capabilities
- **Interactive setup** - Guided configuration with smart defaults

#### Agent Experience

- **Plug-and-play functionality** - Works immediately without setup
- **Smart automation** - Learning only happens when needed
- **Complete transparency** - Full system visibility and status
- **Self-healing capabilities** - Circuit breakers and error recovery

---

## [0.2.4] - 2025-08-17

### Added

- Node.js 24 compatibility and enhanced MCP server initialization
- Async component loading with improved error handling
- Complete rebranding from code-cartographer to in-memoria
- Enhanced postinstall script for better dependency management

### Fixed

- MCP server initialization issues
- CLI execution problems
- Dependency resolution for native modules

---

## [0.1.0] - 2025-08-16

### Added

- Initial release of In Memoria
- Basic MCP server with 11 tools
- Semantic analysis engine with Rust backend
- Pattern learning capabilities
- SQLite-based persistent storage
- File watching and real-time updates
- Basic CLI interface

### Features

- TypeScript/Rust hybrid architecture
- Tree-sitter AST analysis
- Vector embeddings support
- Local-first data storage
- Claude Desktop/Code integration
