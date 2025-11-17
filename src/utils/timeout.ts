/**
 * Timeout Utilities
 *
 * Provides utilities for executing promises with timeouts and cleanup.
 * Extracted to eliminate repeated Promise.race patterns throughout the codebase.
 */

/**
 * Execute a promise with a timeout
 *
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Optional custom error message
 * @returns Promise result or throws timeout error
 *
 * @example
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   'Data fetch timed out after 5 seconds'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              message || `Operation timed out after ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Execute a promise with timeout and cleanup callback
 *
 * Ensures cleanup is called whether the operation succeeds, fails, or times out.
 *
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param cleanup - Cleanup function to call in finally block
 * @param message - Optional custom error message
 * @returns Promise result or throws timeout error
 *
 * @example
 * const result = await withTimeoutAndCleanup(
 *   processData(),
 *   30000,
 *   () => { console.log('Cleaning up resources'); },
 *   'Processing timed out'
 * );
 */
export async function withTimeoutAndCleanup<T>(
  promise: Promise<T>,
  timeoutMs: number,
  cleanup: () => void | Promise<void>,
  message?: string
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, message);
  } finally {
    await cleanup();
  }
}

/**
 * Create a promise that resolves after a delay
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 *
 * @example
 * await delay(1000); // Wait 1 second
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a promise with exponential backoff
 *
 * @param fn - Function that returns a promise
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay in milliseconds (will be doubled each retry)
 * @returns Promise result or throws after all retries exhausted
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetchFromAPI(),
 *   3,
 *   1000
 * ); // Retries at 1s, 2s, 4s
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await delay(delayMs);
      }
    }
  }

  throw lastError!;
}
