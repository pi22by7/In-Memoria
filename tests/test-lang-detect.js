#!/usr/bin/env node

import { SemanticAnalyzer } from './rust-core/index.js';

async function testLanguageDetection() {
  console.log('🔍 Testing language detection...\n');
  
  try {
    const analyzer = new SemanticAnalyzer();
    
    // Test language detection for different files
    console.log('📝 Testing file content analysis with different languages...');
    
    const testCases = [
      {
        filename: 'test.ts',
        content: 'export class UserService { getName() { return "test"; } }'
      },
      {
        filename: 'test.js', 
        content: 'function hello() { return "world"; }'
      },
      {
        filename: 'test.py',
        content: 'class User:\n    def __init__(self):\n        pass'
      },
      {
        filename: 'test.rs',
        content: 'pub struct User { name: String }'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🔍 Testing ${testCase.filename}:`);
      console.log(`   Content: ${testCase.content.substring(0, 50)}...`);
      
      try {
        const concepts = await analyzer.analyzeFileContent(testCase.filename, testCase.content);
        console.log(`   ✅ Found ${concepts.length} concepts`);
        
        if (concepts.length > 0) {
          concepts.forEach(concept => {
            console.log(`      - ${concept.name} (${concept.concept_type}) confidence: ${concept.confidence}`);
          });
        } else {
          console.log(`   ⚠️  No concepts found`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testLanguageDetection();