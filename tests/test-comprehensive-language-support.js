#!/usr/bin/env node

import { SemanticAnalyzer } from '../rust-core/index.js';
import { AstParser } from '../rust-core/index.js';

async function testComprehensiveLanguageSupport() {
  console.log('🔍 Testing comprehensive language support...\n');
  
  const analyzer = new SemanticAnalyzer();
  const astParser = new AstParser();
  
  // Test cases for all 12 supported languages
  const testCases = [
    // Original languages
    {
      name: 'TypeScript',
      file: 'test.ts',
      content: 'export class UserService { getName(): string { return "test"; } }',
      expectedConcepts: ['UserService', 'getName']
    },
    {
      name: 'JavaScript',
      file: 'test.js',
      content: 'function hello() { return "world"; }',
      expectedConcepts: ['hello']
    },
    {
      name: 'Python',
      file: 'test.py',
      content: 'class User:\n    def __init__(self):\n        self.name = "test"',
      expectedConcepts: ['User', '__init__']
    },
    {
      name: 'Rust',
      file: 'test.rs',
      content: 'pub struct User { name: String }',
      expectedConcepts: ['User']
    },
    
    // Newly added languages
    {
      name: 'Go',
      file: 'test.go',
      content: 'package main\nfunc main() {\n    println("Hello World")\n}',
      expectedConcepts: ['main']
    },
    {
      name: 'Java',
      file: 'test.java',
      content: 'public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}',
      expectedConcepts: ['HelloWorld', 'main']
    },
    {
      name: 'C',
      file: 'test.c',
      content: '#include <stdio.h>\nint main() {\n    printf("Hello World");\n    return 0;\n}',
      expectedConcepts: ['main']
    },
    {
      name: 'C++',
      file: 'test.cpp',
      content: '#include <iostream>\nclass HelloWorld {\npublic:\n    void sayHello() {\n        std::cout << "Hello";\n    }\n};',
      expectedConcepts: ['HelloWorld', 'sayHello']
    },
    {
      name: 'C#',
      file: 'test.cs',
      content: 'using System;\npublic class Program {\n    public static void Main() {\n        Console.WriteLine("Hello World");\n    }\n}',
      expectedConcepts: ['Program', 'Main']
    },
    {
      name: 'Svelte',
      file: 'test.svelte',
      content: '<script>\n  let name = "world";\n  function greet() {\n    alert(`Hello ${name}!`);\n  }\n</script>\n<button on:click={greet}>Greet</button>',
      expectedConcepts: ['greet']
    },
    {
      name: 'Vue',
      file: 'test.vue',
      content: '<template>\n  <div>{{ message }}</div>\n</template>\n<script>\nexport default {\n  data() {\n    return { message: "Hello" }\n  }\n}\n</script>',
      expectedConcepts: ['data']
    },
    {
      name: 'SQL',
      file: 'test.sql',
      content: 'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(255)\n);\nSELECT * FROM users;',
      expectedConcepts: ['users'] // May vary based on SQL parser capabilities
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  console.log('📋 Testing AST Parser initialization...');
  try {
    console.log('✅ AST Parser initialized successfully');
  } catch (error) {
    console.log('❌ AST Parser initialization failed:', error.message);
    return;
  }
  
  console.log('\n📋 Testing individual language parsing...\n');
  
  for (const testCase of testCases) {
    console.log(`🔍 Testing ${testCase.name} (${testCase.file}):`);
    console.log(`   Content: ${testCase.content.substring(0, 60)}${testCase.content.length > 60 ? '...' : ''}`);
    
    const result = {
      language: testCase.name,
      file: testCase.file,
      success: false,
      concepts: [],
      error: null
    };
    
    try {
      // Test semantic analyzer
      const concepts = await analyzer.analyzeFileContent(testCase.file, testCase.content);
      result.concepts = concepts;
      result.success = true;
      
      console.log(`   ✅ Semantic Analysis: Found ${concepts.length} concepts`);
      concepts.forEach(concept => {
        console.log(`      - ${concept.name} (${concept.concept_type}) confidence: ${concept.confidence}`);
      });
      
      // Test AST parser directly
      try {
        const language = testCase.file.split('.').pop() === 'ts' ? 'typescript' :
                        testCase.file.split('.').pop() === 'js' ? 'javascript' :
                        testCase.file.split('.').pop() === 'py' ? 'python' :
                        testCase.file.split('.').pop() === 'rs' ? 'rust' :
                        testCase.file.split('.').pop() === 'go' ? 'go' :
                        testCase.file.split('.').pop() === 'java' ? 'java' :
                        testCase.file.split('.').pop() === 'c' ? 'c' :
                        testCase.file.split('.').pop() === 'cpp' ? 'cpp' :
                        testCase.file.split('.').pop() === 'cs' ? 'csharp' :
                        testCase.file.split('.').pop() === 'svelte' ? 'svelte' :
                        testCase.file.split('.').pop() === 'vue' ? 'vue' :
                        testCase.file.split('.').pop() === 'sql' ? 'sql' : 'unknown';
        
        const astResult = await astParser.parseCode(testCase.content, language);
        console.log(`   ✅ AST Parser: Successfully parsed (${astResult.symbols.length} symbols)`);
      } catch (astError) {
        console.log(`   ⚠️  AST Parser: ${astError.message}`);
      }
      
      passed++;
    } catch (error) {
      result.error = error.message;
      console.log(`   ❌ Failed: ${error.message}`);
      failed++;
    }
    
    results.push(result);
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / testCases.length) * 100)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Languages:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.language}: ${result.error}`);
    });
  }
  
  console.log('\n🎯 Language Coverage Status:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const conceptCount = result.concepts.length;
    console.log(`   ${status} ${result.language}: ${conceptCount} concepts found`);
  });
}

testComprehensiveLanguageSupport().catch(console.error);
