/**
 * Application Constants
 *
 * Centralized constants to eliminate magic numbers throughout the codebase.
 * Extracted from various files as part of KISS refactoring.
 */

/**
 * Timeout configurations (in milliseconds)
 */
export const TIMEOUTS = {
  /** Cache time-to-live (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,

  /** Learning operation timeout (5 minutes) */
  LEARNING_TIMEOUT_MS: 5 * 60 * 1000,

  /** Pattern analysis timeout (2 minutes) */
  PATTERN_TIMEOUT_MS: 2 * 60 * 1000,

  /** Default operation timeout (30 seconds) */
  DEFAULT_TIMEOUT_MS: 30 * 1000,

  /** Semantic search timeout (1 minute) */
  SEMANTIC_SEARCH_TIMEOUT_MS: 60 * 1000,
} as const;

/**
 * Confidence thresholds for pattern detection
 */
export const CONFIDENCE_THRESHOLDS = {
  /** High confidence threshold - used for "error" severity violations */
  HIGH: 0.85,

  /** Medium confidence threshold - used for "warning" severity */
  MEDIUM: 0.70,

  /** Low confidence threshold - used for "info" severity */
  LOW: 0.50,

  /** Minimum viable confidence for consideration */
  MINIMUM: 0.30,
} as const;

/**
 * Vector embedding dimensions and limits
 */
export const VECTOR_DIMENSIONS = {
  /** Local embedding dimension size */
  LOCAL: 384,

  /** Maximum vectors to keep in memory cache */
  CACHE_SIZE: 1000,

  /** Maximum results to return from vector search */
  MAX_RESULTS: 100,
} as const;

/**
 * Database query limits
 */
export const DB_LIMITS = {
  /** Maximum concepts to return in a single query */
  MAX_CONCEPTS: 1000,

  /** Maximum patterns to return in a single query */
  MAX_PATTERNS: 500,

  /** Batch size for bulk insertions */
  BATCH_SIZE: 100,

  /** Maximum search results */
  MAX_SEARCH_RESULTS: 50,
} as const;

/**
 * Search configuration
 */
export const SEARCH_CONFIG = {
  /** Default number of search results */
  DEFAULT_LIMIT: 20,

  /** Maximum search results allowed */
  MAX_LIMIT: 100,

  /** Minimum similarity score to include in results */
  MIN_SIMILARITY: 0.6,

  /** Similarity threshold for "high confidence" matches */
  HIGH_SIMILARITY: 0.8,
} as const;

/**
 * Performance and optimization settings
 */
export const PERFORMANCE = {
  /** Maximum recursion depth for directory traversal */
  MAX_DIRECTORY_DEPTH: 5,

  /** Maximum file size to analyze (in bytes) - 10MB */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /** Number of files to process in parallel */
  PARALLEL_FILE_LIMIT: 10,
} as const;

/**
 * Incremental learning settings
 */
export const INCREMENTAL_LEARNING = {
  /** Target time for incremental learning updates (in seconds) */
  TARGET_UPDATE_TIME_SECONDS: 5,

  /** Maximum queue size before throttling */
  MAX_QUEUE_SIZE: 100,
} as const;
