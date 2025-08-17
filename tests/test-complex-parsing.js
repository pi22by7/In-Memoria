#!/usr/bin/env node

import { SemanticAnalyzer } from './rust-core/index.js';

async function testComplexParsing() {
  console.log('🔍 Testing complex code parsing...\n');
  
  const analyzer = new SemanticAnalyzer();
  
  // Complex TypeScript example
  const complexTS = `
export class UserService {
    private apiClient: ApiClient;
    
    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }
    
    async getUser(id: string): Promise<User> {
        return this.apiClient.get(\`/users/\${id}\`);
    }
    
    createUser(userData: CreateUserRequest): Promise<User> {
        return this.apiClient.post('/users', userData);
    }
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface CreateUserRequest {
    name: string;
    email: string;
}

export function validateEmail(email: string): boolean {
    return email.includes('@');
}
`;

  console.log('📝 Complex TypeScript example:');
  try {
    const concepts = await analyzer.analyzeFileContent('complex.ts', complexTS);
    console.log(`   Found ${concepts.length} concepts:`);
    concepts.forEach((concept, i) => {
      console.log(`   [${i+1}] ${concept.name} (${concept.conceptType}) - confidence: ${concept.confidence}`);
      console.log(`       Line ${concept.lineRange.start}-${concept.lineRange.end} in ${concept.filePath}`);
    });
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  // Complex Python example
  const complexPython = `
class DatabaseManager:
    def __init__(self, connection_string):
        self.connection = connect(connection_string)
        self.cache = {}
    
    def get_user(self, user_id):
        if user_id in self.cache:
            return self.cache[user_id]
        
        user = self.connection.execute("SELECT * FROM users WHERE id = ?", user_id)
        self.cache[user_id] = user
        return user
    
    def create_user(self, name, email):
        user_id = self.connection.execute(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            name, email
        )
        return user_id

def validate_email(email):
    return "@" in email and "." in email

def hash_password(password):
    return sha256(password.encode()).hexdigest()
`;

  console.log('\n📝 Complex Python example:');
  try {
    const concepts = await analyzer.analyzeFileContent('complex.py', complexPython);
    console.log(`   Found ${concepts.length} concepts:`);
    concepts.forEach((concept, i) => {
      console.log(`   [${i+1}] ${concept.name} (${concept.conceptType}) - confidence: ${concept.confidence}`);
      console.log(`       Line ${concept.lineRange.start}-${concept.lineRange.end} in ${concept.filePath}`);
    });
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
}

testComplexParsing();