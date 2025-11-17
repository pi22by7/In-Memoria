/**
 * Hash Utilities
 *
 * Simple hash function for generating short, deterministic identifiers.
 * Extracted from semantic-engine.ts, pattern-engine.ts, and vector-db.ts.
 */

/**
 * Generate a simple hash from a string
 *
 * Uses a 32-bit integer hash algorithm for speed.
 * Converts to base-36 for compact representation.
 *
 * @param str - String to hash
 * @param maxLength - Maximum length of hash output (default: 16)
 * @returns Hash string in base-36 format
 *
 * @example
 * simpleHash('my-unique-identifier') // => 'a2b3c4d5'
 * simpleHash('another-string', 8) // => 'x7y8z9a0'
 */
export function simpleHash(str: string, maxLength: number = 16): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashStr = Math.abs(hash).toString(36);
  return hashStr.substring(0, maxLength);
}
