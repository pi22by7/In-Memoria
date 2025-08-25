#!/usr/bin/env node

import { SemanticEngine } from '../dist/engines/semantic-engine.js';
import { SQLiteDatabase } from '../dist/storage/sqlite-db.js';
import { SemanticVectorDB } from '../dist/storage/vector-db.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';

async function testCachingConsistency() {
  console.log('🔍 Testing caching consistency...\n');
  
  // Create temporary test files
  const testDir = join(tmpdir(), 'in-memoria-cache-test');
  const testFile = join(testDir, 'test.ts');
  const dbPath = join(testDir, 'test.db');
  
  const testContent1 = 'export class UserService { getName() { return "test1"; } }';
  const testContent2 = 'export class UserService { getName() { return "test2"; } }';
  
  try {
    // Ensure test directory exists
    if (!existsSync(testDir)) {
      console.log('Creating test directory...');
      mkdirSync(testDir, { recursive: true });
    }
    
    // Initialize engines
    const db = new SQLiteDatabase(dbPath);
    const vectorDB = new SemanticVectorDB();
    const engine = new SemanticEngine(db, vectorDB);
    
    console.log('📝 Test 1: Analyze initial content');
    writeFileSync(testFile, testContent1);
    const concepts1 = await engine.analyzeFileContent(testFile, testContent1);
    console.log(`   Found ${concepts1.length} concepts`);
    concepts1.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    
    console.log('\n📝 Test 2: Analyze modified content');
    writeFileSync(testFile, testContent2);
    const concepts2 = await engine.analyzeFileContent(testFile, testContent2);
    console.log(`   Found ${concepts2.length} concepts`);
    concepts2.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    
    console.log('\n📝 Test 3: Re-analyze same content (should be consistent)');
    const concepts3 = await engine.analyzeFileContent(testFile, testContent2);
    console.log(`   Found ${concepts3.length} concepts`);
    concepts3.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    
    // Verify consistency
    const consistent = JSON.stringify(concepts2) === JSON.stringify(concepts3);
    console.log(`\n✅ Caching consistency: ${consistent ? 'PASS' : 'FAIL'}`);
    
    if (!consistent) {
      console.log('❌ Detected caching inconsistency!');
      console.log('Test 2 results:', JSON.stringify(concepts2, null, 2));
      console.log('Test 3 results:', JSON.stringify(concepts3, null, 2));
    }
    
    // Test with new SemanticEngine instance (fresh instance)
    console.log('\n📝 Test 4: New engine instance with same content');
    const engine2 = new SemanticEngine(new SQLiteDatabase(dbPath + '2'), new SemanticVectorDB());
    const concepts4 = await engine2.analyzeFileContent(testFile, testContent2);
    console.log(`   Found ${concepts4.length} concepts`);
    concepts4.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    
    const freshInstanceConsistent = concepts4.length === concepts2.length;
    console.log(`\n✅ Fresh instance consistency: ${freshInstanceConsistent ? 'PASS' : 'FAIL'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    try {
      if (existsSync(testFile)) unlinkSync(testFile);
      if (existsSync(dbPath)) unlinkSync(dbPath);
      if (existsSync(dbPath + '2')) unlinkSync(dbPath + '2');
    } catch (cleanupError) {
      console.warn('Cleanup failed:', cleanupError.message);
    }
  }
}

testCachingConsistency();