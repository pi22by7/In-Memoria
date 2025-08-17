#!/usr/bin/env node

import { SemanticAnalyzer } from './rust-core/index.js';

async function testRustAnalyzer() {
  console.log('🔍 Testing Rust Semantic Analyzer directly...\n');
  
  try {
    const analyzer = new SemanticAnalyzer();
    
    // Test with a simple TypeScript file
    console.log('📝 Testing file content analysis...');
    const testContent = `
export class UserService {
  private users: User[] = [];
  
  async createUser(userData: CreateUserRequest): Promise<User> {
    const user = new User(userData);
    this.users.push(user);
    return user;
  }
  
  async getUserById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
}
`;
    
    const concepts = await analyzer.analyzeFileContent('test.ts', testContent);
    console.log(`✅ Found ${concepts.length} concepts:`);
    concepts.forEach(concept => {
      console.log(`   - ${concept.name} (${concept.concept_type}) - confidence: ${concept.confidence}`);
    });
    
    // Test learning from a directory 
    console.log('\n📚 Testing codebase learning...');
    const learnedConcepts = await analyzer.learnFromCodebase('./src/engines');
    console.log(`✅ Learned ${learnedConcepts.length} concepts from ./src/engines:`);
    learnedConcepts.slice(0, 10).forEach(concept => {
      console.log(`   - ${concept.name} (${concept.concept_type}) in ${concept.file_path}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testRustAnalyzer();