#!/usr/bin/env node

import { SemanticAnalyzer } from '../rust-core/index.js';

async function testTreeSitterBasics() {
  console.log('🔍 Testing basic tree-sitter functionality...\n');
  
  try {
    const analyzer = new SemanticAnalyzer();
    
    // Test with extremely simple code that should definitely parse
    const simpleCases = [
      {
        name: 'Simple TypeScript class',
        file: 'simple.ts',
        content: 'class Test {}'
      },
      {
        name: 'Simple JavaScript function',
        file: 'simple.js', 
        content: 'function test() {}'
      },
      {
        name: 'Simple Python class',
        file: 'simple.py',
        content: 'class Test:\n    pass'
      },
      {
        name: 'Simple Rust struct',
        file: 'simple.rs',
        content: 'struct Test {}'
      }
    ];
    
    for (const testCase of simpleCases) {
      console.log(`\n📝 ${testCase.name}:`);
      console.log(`   File: ${testCase.file}`);
      console.log(`   Content: "${testCase.content}"`);
      
      try {
        const concepts = await analyzer.analyzeFileContent(testCase.file, testCase.content);
        console.log(`   Result: ${concepts.length} concepts found`);
        
        if (concepts.length > 0) {
          concepts.forEach((concept, i) => {
            console.log(`   [${i}] ${concept.name} (${concept.conceptType}) - ${concept.confidence}`);
          });
        } else {
          console.log(`   ❌ No concepts extracted - tree-sitter or extraction logic issue`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        if (error.message.includes('Unsupported language')) {
          console.log(`   🔍 Language detection issue`);
        } else if (error.message.includes('Failed to parse')) {
          console.log(`   🔍 Tree-sitter parsing issue`);
        }
      }
    }
    
    // Test an invalid case to see error handling
    console.log(`\n📝 Testing error handling:`);
    try {
      await analyzer.analyzeFileContent('unknown.xyz', 'invalid content');
    } catch (error) {
      console.log(`   ✅ Correctly caught error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    console.error('Stack:', error.stack);
  }
}

testTreeSitterBasics();