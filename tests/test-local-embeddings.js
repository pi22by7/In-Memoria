#!/usr/bin/env node

// Simple test for local embedding generation
console.log('🧪 Testing Local Embedding Generation...\n');

// Test code sample
const testCode = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`;

// Simulate the advanced local embedding logic
function generateAdvancedLocalEmbedding(code) {
    const LOCAL_EMBEDDING_DIMENSION = 384;
    const embedding = new Array(LOCAL_EMBEDDING_DIMENSION).fill(0);

    // 1. Structural features (25%)
    const structural = extractStructuralFeatures(code);
    const structuralSize = Math.floor(LOCAL_EMBEDDING_DIMENSION * 0.25);
    for (let i = 0; i < Math.min(structuralSize, structural.length); i++) {
        embedding[i] = structural[i];
    }

    // 2. Semantic token features (35%)
    const semantic = extractSemanticFeatures(code);
    const semanticSize = Math.floor(LOCAL_EMBEDDING_DIMENSION * 0.35);
    for (let i = 0; i < Math.min(semanticSize, semantic.length); i++) {
        embedding[structuralSize + i] = semantic[i];
    }

    // 3. AST-based features (25%)
    const ast = extractASTFeatures(code);
    const astSize = Math.floor(LOCAL_EMBEDDING_DIMENSION * 0.25);
    const astStart = structuralSize + semanticSize;
    for (let i = 0; i < Math.min(astSize, ast.length); i++) {
        embedding[astStart + i] = ast[i];
    }

    // 4. Context features (15%)
    const context = extractContextFeatures(code);
    const contextSize = LOCAL_EMBEDDING_DIMENSION - astStart - astSize;
    const contextStart = astStart + astSize;
    for (let i = 0; i < Math.min(contextSize, context.length); i++) {
        embedding[contextStart + i] = context[i];
    }

    return normalizeVector(embedding);
}

function extractStructuralFeatures(code) {
    const features = [];

    // Function density
    const functions = (code.match(/function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>)/g) || []).length;
    features.push(Math.min(functions / 10, 1));

    // Class density
    const classes = (code.match(/class\s+\w+/g) || []).length;
    features.push(Math.min(classes / 5, 1));

    // Import/export density
    const imports = (code.match(/import\s+.*from|export\s+/g) || []).length;
    features.push(Math.min(imports / 10, 1));

    // Async patterns
    const async = (code.match(/async\s+|await\s+|Promise/g) || []).length;
    features.push(Math.min(async / 8, 1));

    // Control flow complexity
    const control = (code.match(/if\s*\(|for\s*\(|while\s*\(|switch\s*\(/g) || []).length;
    features.push(Math.min(control / 15, 1));

    // Pad to required size
    while (features.length < 96) {
        features.push(0);
    }

    return features.slice(0, 96);
}

function extractSemanticFeatures(code) {
    const features = [];
    const tokens = extractMeaningfulTokens(code);

    // Simple semantic scoring
    const keywords = ['function', 'class', 'return', 'if', 'for', 'while'];
    for (const keyword of keywords) {
        const count = tokens.filter(token =>
            token.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        features.push(Math.min(count / 5, 1));
    }

    // Pad to required size
    while (features.length < 134) {
        features.push(0);
    }

    return features.slice(0, 134);
}

function extractASTFeatures(code) {
    const features = [];

    // Declaration patterns
    const declarations = {
        variables: /(?:let|const|var)\s+\w+/g,
        functions: /function\s+\w+/g,
        classes: /class\s+\w+/g
    };

    for (const [_, pattern] of Object.entries(declarations)) {
        const count = (code.match(pattern) || []).length;
        features.push(Math.min(count / 8, 1));
    }

    // Pad to required size
    while (features.length < 96) {
        features.push(0);
    }

    return features.slice(0, 96);
}

function extractContextFeatures(code) {
    const features = [];

    // Code quality indicators
    const comments = (code.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || []).join('').length;
    features.push(Math.min(comments / code.length, 1));

    const strings = (code.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || []).join('').length;
    features.push(Math.min(strings / code.length, 0.5));

    // Line metrics
    const lines = code.split('\n').length;
    const avgLineLength = code.length / lines;
    features.push(Math.min(lines / 100, 1));
    features.push(Math.min(avgLineLength / 80, 1));

    // Pad to required size
    while (features.length < 58) {
        features.push(0);
    }

    return features.slice(0, 58);
}

function extractMeaningfulTokens(code) {
    // Remove comments and strings
    const cleanCode = code
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/["'`][^"'`]*["'`]/g, 'STRING');

    // Extract identifiers and keywords
    const tokens = cleanCode.match(/\b[a-zA-Z][a-zA-Z0-9_]*\b/g) || [];

    // Filter out very short tokens
    return tokens.filter(token => token.length > 2);
}

function normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
}

// Run the test
const startTime = Date.now();
const embedding = generateAdvancedLocalEmbedding(testCode);
const duration = Date.now() - startTime;

console.log(`✅ Generated local embedding: ${embedding.length} dimensions`);
console.log(`⏱️  Time taken: ${duration}ms`);
console.log(`📈 Sample values: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}, ...]`);
console.log(`🔍 Non-zero features: ${embedding.filter(v => v !== 0).length}`);
console.log(`📊 Vector magnitude: ${Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`);

// Test similarity calculation
const testCode2 = `
function add(a, b) {
  return a + b;
}
`;

const embedding2 = generateAdvancedLocalEmbedding(testCode2);

// Calculate cosine similarity
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    return dotProduct; // Vectors are already normalized
}

const similarity = cosineSimilarity(embedding, embedding2);
console.log(`🎯 Similarity between fibonacci and add functions: ${similarity.toFixed(4)}`);

console.log('\n🎉 Local embedding test completed successfully!');
