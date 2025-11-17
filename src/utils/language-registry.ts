/**
 * Central registry for language detection based on file extensions.
 * Keeps engines, watchers, and tooling aligned on canonical language keys.
 *
 * Note: Keys are extension names WITHOUT the leading dot (e.g., 'ts' not '.ts').
 * The detectLanguageFromPath function handles stripping the dot from file paths.
 */

export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  // TypeScript / JavaScript ecosystem (tree-sitter + extractors in place)
  ts: 'typescript',
  tsx: 'typescript',
  cts: 'typescript',
  mts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Python (tree-sitter + extractor supported)
  py: 'python',

  // Rust
  rs: 'rust',

  // Go
  go: 'go',

  // Java
  java: 'java',

  // C-family (tree-sitter parsers registered)
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  cs: 'csharp',

  // Svelte (parser+extractor registered)
  svelte: 'svelte',

  // SQL (parser+extractor registered)
  sql: 'sql',

  // PHP support
  php: 'php',
  phtml: 'php',
  // Note: .inc is commonly used for PHP includes but may also be used by other languages
  // (Perl, Apache configs). Consider this a PHP-first assumption that may cause false positives.
  inc: 'php'
};

/**
 * Languages with first-class parser support in the Rust core.
 * Keep this in sync with `ParserManager::initialize_parsers`.
 */
export const PARSER_SUPPORTED_LANGUAGES = new Set<string>([
  'typescript',
  'javascript',
  'rust',
  'python',
  'sql',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'svelte',
  'php'
]);

/**
 * Detect canonical language name from a file path.
 * Falls back to 'unknown' when the extension is not recognised.
 */
export function detectLanguageFromPath(filePath: string): string {
  const parts = filePath.toLowerCase().split('.');
  if (parts.length < 2) {
    return 'unknown';
  }

  const extension = parts.pop() as string;
  return EXTENSION_LANGUAGE_MAP[extension] ?? 'unknown';
}

/**
 * Return true when the language has parser support in the Rust core.
 */
export function isParserSupportedLanguage(language: string): boolean {
  return PARSER_SUPPORTED_LANGUAGES.has(language);
}

/**
 * Detect language from pattern content or metadata.
 * Useful for analyzing patterns that reference languages or file types.
 */
export function detectLanguageFromPattern(pattern: any): string {
  const content = typeof pattern === 'string'
    ? pattern
    : JSON.stringify(pattern);

  const contentLower = content.toLowerCase();

  // Check for language keywords in pattern content
  if (contentLower.includes('typescript') || contentLower.includes('.ts')) return 'typescript';
  if (contentLower.includes('javascript') || contentLower.includes('.js')) return 'javascript';
  if (contentLower.includes('python') || contentLower.includes('.py')) return 'python';
  if (contentLower.includes('rust') || contentLower.includes('.rs')) return 'rust';
  if (contentLower.includes('go') || contentLower.includes('.go')) return 'go';
  if (contentLower.includes('java') || contentLower.includes('.java')) return 'java';
  if (contentLower.includes('c++') || contentLower.includes('.cpp')) return 'cpp';
  if (contentLower.includes('.c') || contentLower.includes(' c ')) return 'c';
  if (contentLower.includes('c#') || contentLower.includes('csharp') || contentLower.includes('.cs')) return 'csharp';
  if (contentLower.includes('php') || contentLower.includes('.php')) return 'php';
  if (contentLower.includes('ruby') || contentLower.includes('.rb')) return 'ruby';
  if (contentLower.includes('swift') || contentLower.includes('.swift')) return 'swift';
  if (contentLower.includes('kotlin') || contentLower.includes('.kt')) return 'kotlin';
  if (contentLower.includes('svelte') || contentLower.includes('.svelte')) return 'svelte';
  if (contentLower.includes('sql') || contentLower.includes('.sql')) return 'sql';

  return 'unknown';
}
