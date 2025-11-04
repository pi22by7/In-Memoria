/**
 * Central registry for language detection based on file extensions.
 * Keeps engines, watchers, and tooling aligned on canonical language keys.
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
