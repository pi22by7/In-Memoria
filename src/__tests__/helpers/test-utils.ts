/**
 * Test utility functions
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Create a temporary test directory with optional files
 */
export function createTestWorkspace(files?: Record<string, string>): {
    path: string;
    cleanup: () => void;
} {
    const path = mkdtempSync(join(tmpdir(), 'in-memoria-workspace-'));

    // Create files if provided
    if (files) {
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = join(path, filePath);
            const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

            // Create parent directories
            mkdirSync(dir, { recursive: true });

            // Write file
            writeFileSync(fullPath, content, 'utf-8');
        }
    }

    return {
        path,
        cleanup: () => {
            try {
                rmSync(path, { recursive: true, force: true });
            } catch (error) {
                console.warn(`Failed to cleanup test workspace: ${path}`, error);
            }
        },
    };
}

/**
 * Create sample code files for testing
 */
export const sampleCode = {
    typescript: {
        simpleClass: `
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

interface CreateUserRequest {
  name: string;
  email: string;
}
`,
        reactComponent: `
import React, { useState, useEffect } from 'react';

interface Props {
  userId: string;
}

export const UserProfile: React.FC<Props> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(userId);
  }, [userId]);
  
  const fetchUser = async (id: string) => {
    const response = await fetch(\`/api/users/\${id}\`);
    const data = await response.json();
    setUser(data);
    setLoading(false);
  };
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;
  
  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};
`,
    },

    javascript: {
        simpleFunction: `
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
`,
    },

    python: {
        simpleClass: `
class DataProcessor:
    def __init__(self, data):
        self.data = data
        self.processed = False
    
    def process(self):
        if not self.processed:
            self.data = [item * 2 for item in self.data]
            self.processed = True
        return self.data
    
    def reset(self):
        self.processed = False
`,
    },
};

/**
 * Wait for a condition to be true
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a mock database path for testing
 */
export function createTestDbPath(name: string = 'test'): string {
    const tempDir = mkdtempSync(join(tmpdir(), 'in-memoria-db-'));
    return join(tempDir, `${name}.db`);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function multiple times
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(delayMs);
            }
        }
    }

    throw lastError;
}
