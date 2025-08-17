#!/usr/bin/env node

import { SemanticAnalyzer } from './rust-core/index.js';

async function testCodebaseAnalysis() {
  console.log('🔍 Testing full codebase analysis...\n');
  
  const analyzer = new SemanticAnalyzer();
  
  try {
    console.log('📁 Analyzing src/ directory...');
    const result = await analyzer.analyzeCodebase('./src');
    
    console.log('\n📊 Analysis Results:');
    console.log(`   Languages detected: ${result.languages.join(', ')}`);
    console.log(`   Frameworks detected: ${result.frameworks.join(', ')}`);
    console.log(`   Total concepts found: ${result.concepts.length}`);
    
    console.log('\n📈 Complexity Metrics:');
    console.log(`   Cyclomatic complexity: ${result.complexity.cyclomatic.toFixed(2)}`);
    console.log(`   Cognitive complexity: ${result.complexity.cognitive.toFixed(2)}`);
    console.log(`   Total lines: ${result.complexity.lines}`);
    
    console.log('\n🎯 Concept Breakdown:');
    const conceptTypes = {};
    result.concepts.forEach(concept => {
      conceptTypes[concept.conceptType] = (conceptTypes[concept.conceptType] || 0) + 1;
    });
    
    Object.entries(conceptTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log('\n📝 Sample concepts (first 10):');
    result.concepts.slice(0, 10).forEach((concept, i) => {
      console.log(`   [${i+1}] ${concept.name} (${concept.conceptType}) in ${concept.filePath.split('/').pop()}`);
    });
    
    if (result.concepts.length > 10) {
      console.log(`   ... and ${result.concepts.length - 10} more concepts`);
    }
    
  } catch (error) {
    console.error(`❌ Codebase analysis failed: ${error.message}`);
    console.error('Stack:', error.stack);
  }
}

testCodebaseAnalysis();