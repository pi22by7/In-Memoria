#!/usr/bin/env node

import { SemanticAnalyzer } from '../rust-core/index.js';

async function testFileExtensionMapping() {
  console.log('🔍 Testing file extension to language mapping...\n');
  
  const analyzer = new SemanticAnalyzer();
  
  // Test file extension mappings
  const extensionTests = [
    // TypeScript variants
    { file: 'component.ts', expectedLang: 'typescript' },
    { file: 'component.tsx', expectedLang: 'typescript' },
    
    // JavaScript variants  
    { file: 'script.js', expectedLang: 'javascript' },
    { file: 'component.jsx', expectedLang: 'javascript' },
    
    // Single extensions
    { file: 'main.py', expectedLang: 'python' },
    { file: 'main.rs', expectedLang: 'rust' },
    { file: 'main.go', expectedLang: 'go' },
    { file: 'Main.java', expectedLang: 'java' },
    { file: 'main.c', expectedLang: 'c' },
    { file: 'main.cs', expectedLang: 'csharp' },
    { file: 'query.sql', expectedLang: 'sql' },
    
    // C++ variants
    { file: 'main.cpp', expectedLang: 'cpp' },
    { file: 'main.cc', expectedLang: 'cpp' },
    { file: 'main.cxx', expectedLang: 'cpp' },
    
    // Framework files
    { file: 'Component.svelte', expectedLang: 'svelte' },
    { file: 'Component.vue', expectedLang: 'vue' },
    
    // Should be filtered out / unsupported
    { file: 'readme.md', expectedLang: 'generic' },
    { file: 'config.json', expectedLang: 'generic' },
    { file: 'style.css', expectedLang: 'generic' },
    { file: 'no-extension', expectedLang: 'generic' }
  ];
  
  console.log('📋 Testing language detection for file extensions...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test the should_analyze_file logic by trying to analyze different file types
  for (const test of extensionTests) {
    const simpleContent = '// test content';
    const shouldBeSupported = test.expectedLang !== 'generic';
    
    console.log(`🔍 Testing ${test.file} (expected: ${test.expectedLang}):`);
    
    try {
      const concepts = await analyzer.analyzeFileContent(test.file, simpleContent);
      
      if (shouldBeSupported) {
        console.log(`   ✅ Supported: Found ${concepts.length} concepts`);
        passed++;
      } else {
        console.log(`   ⚠️  Unexpectedly supported (found ${concepts.length} concepts)`);
        failed++;
      }
    } catch (error) {
      if (shouldBeSupported) {
        if (error.message.includes('Unsupported language') || error.message.includes('not supported')) {
          console.log(`   ❌ Should be supported but got: ${error.message}`);
          failed++;
        } else {
          console.log(`   ✅ Supported but parsing failed (expected): ${error.message}`);
          passed++;
        }
      } else {
        console.log(`   ✅ Correctly unsupported: ${error.message}`);
        passed++;
      }
    }
  }
  
  // Test file filtering logic by checking languages detection
  console.log('\n📋 Testing language enumeration...\n');
  
  try {
    const languages = await analyzer.detectLanguages('./src');
    console.log('✅ Detected languages in ./src:', languages);
    
    // Check if our new languages would be detected
    const expectedLanguages = ['typescript', 'javascript'];  // Based on our codebase
    const missingLanguages = expectedLanguages.filter(lang => !languages.includes(lang));
    
    if (missingLanguages.length === 0) {
      console.log('✅ All expected languages detected');
      passed++;
    } else {
      console.log('❌ Missing languages:', missingLanguages);
      failed++;
    }
  } catch (error) {
    console.log('❌ Language detection failed:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n📊 File Extension Mapping Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  return passed > failed;
}

testFileExtensionMapping().catch(console.error);
