/**
 * String Similarity Utilities
 *
 * Algorithms for calculating similarity between strings.
 * Extracted from pattern-aggregator.ts to centralize similarity calculations.
 */

/**
 * String Similarity Calculator
 */
export class StringSimilarity {
  /**
   * Calculate bigram similarity between two strings
   *
   * Uses the Sørensen-Dice coefficient based on character bigrams.
   * Returns a value between 0 (completely different) and 1 (identical).
   *
   * @param str1 - First string to compare
   * @param str2 - Second string to compare
   * @returns Similarity score (0-1)
   *
   * @example
   * StringSimilarity.bigramSimilarity('hello', 'hallo') // => ~0.67
   * StringSimilarity.bigramSimilarity('test', 'test') // => 1.0
   * StringSimilarity.bigramSimilarity('abc', 'xyz') // => 0.0
   */
  static bigramSimilarity(str1: string, str2: string): number {
    const bigrams1 = this.getBigrams(str1.toLowerCase());
    const bigrams2 = this.getBigrams(str2.toLowerCase());

    // Handle empty string cases
    if (bigrams1.length === 0 && bigrams2.length === 0) return 1.0;
    if (bigrams1.length === 0 || bigrams2.length === 0) return 0.0;

    // Count matching bigrams
    const intersection = bigrams1.filter((b) => bigrams2.includes(b));

    // Sørensen-Dice coefficient: 2 * |intersection| / (|A| + |B|)
    return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
  }

  /**
   * Extract bigrams from a string
   *
   * @param str - String to extract bigrams from
   * @returns Array of bigram strings
   *
   * @example
   * getBigrams('hello') // => ['he', 'el', 'll', 'lo']
   */
  private static getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Calculate Jaccard similarity between two strings based on bigrams
   *
   * Uses set intersection and union of character bigrams.
   * Returns a value between 0 (completely different) and 1 (identical).
   *
   * @param str1 - First string to compare
   * @param str2 - Second string to compare
   * @returns Similarity score (0-1)
   *
   * @example
   * StringSimilarity.jaccardSimilarity('hello', 'hallo') // => ~0.60
   * StringSimilarity.jaccardSimilarity('test', 'test') // => 1.0
   */
  static jaccardSimilarity(str1: string, str2: string): number {
    const bigrams1 = new Set(this.getBigrams(str1.toLowerCase()));
    const bigrams2 = new Set(this.getBigrams(str2.toLowerCase()));

    // Handle empty cases
    if (bigrams1.size === 0 && bigrams2.size === 0) return 1.0;
    if (bigrams1.size === 0 || bigrams2.size === 0) return 0.0;

    // Calculate intersection
    const intersection = new Set([...bigrams1].filter((b) => bigrams2.has(b)));

    // Calculate union
    const union = new Set([...bigrams1, ...bigrams2]);

    // Jaccard coefficient: |intersection| / |union|
    return intersection.size / union.size;
  }

  /**
   * Calculate simple Levenshtein distance between two strings
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance (number of operations needed to transform str1 into str2)
   *
   * @example
   * StringSimilarity.levenshteinDistance('kitten', 'sitting') // => 3
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create distance matrix
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate normalized Levenshtein similarity (0-1)
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score (0-1)
   */
  static levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1.0 : 1 - distance / maxLength;
  }
}
