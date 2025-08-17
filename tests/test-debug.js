#!/usr/bin/env node

import { SemanticAnalyzer } from './rust-core/index.js';
import fs from 'fs';

async function testWithTempFile() {
  console.log('🔍 Testing with temporary file...\n');
  
  try {
    // Create a test directory and file
    const testDir = './temp-test';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    
    const testFile = `${testDir}/example.ts`;
    const testContent = `export class UserService {
  private users: User[] = [];
  
  async createUser(userData: CreateUserRequest): Promise<User> {
    const user = new User(userData);
    this.users.push(user);
    return user;
  }
}

interface User {
  id: string;
  name: string;
}

function validateUser(user: User): boolean {
  return user.id && user.name;
}`;
    
    fs.writeFileSync(testFile, testContent);
    console.log(`📝 Created test file: ${testFile}`);
    console.log(`Content length: ${testContent.length} characters`);
    
    const analyzer = new SemanticAnalyzer();
    
    // Test single file analysis
    console.log('\n🔍 Testing single file analysis...');
    const fileConcepts = await analyzer.analyzeFileContent(testFile, testContent);
    console.log(`✅ File analysis found ${fileConcepts.length} concepts:`);
    fileConcepts.forEach(concept => {
      console.log(`   - ${concept.name} (${concept.concept_type}) - confidence: ${concept.confidence}`);
    });
    
    // Test directory learning
    console.log('\n📚 Testing directory learning...');
    const learnedConcepts = await analyzer.learnFromCodebase(testDir);
    console.log(`✅ Directory learning found ${learnedConcepts.length} concepts:`);
    learnedConcepts.forEach(concept => {
      console.log(`   - ${concept.name} (${concept.concept_type}) in ${concept.file_path}`);
    });
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('\n🧹 Cleaned up test files');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testWithTempFile();