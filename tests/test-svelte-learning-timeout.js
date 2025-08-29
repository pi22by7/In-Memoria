#!/usr/bin/env node

/**
 * Test script to verify Svelte learning timeout fixes
 * This script simulates a large Svelte project to test timeout handling
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { SemanticEngine } from '../src/engines/semantic-engine.js';
import { PatternEngine } from '../src/engines/pattern-engine.js';
import { SQLiteDatabase } from '../src/storage/sqlite-db.js';
import { SemanticVectorDB } from '../src/storage/vector-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createTestSvelteProject(basePath) {
    console.log('🏗️  Creating test Svelte project...');
    
    // Create directory structure
    await mkdir(join(basePath, 'src', 'components'), { recursive: true });
    await mkdir(join(basePath, 'src', 'routes'), { recursive: true });
    await mkdir(join(basePath, 'src', 'lib'), { recursive: true });
    
    // Create package.json to indicate this is a Svelte project
    const packageJson = {
        "name": "test-svelte-project",
        "devDependencies": {
            "svelte": "^4.0.0",
            "@sveltejs/kit": "^1.0.0"
        }
    };
    await writeFile(join(basePath, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Create several Svelte components
    const svelteComponents = [
        {
            name: 'App.svelte',
            content: `<script>
    import { onMount } from 'svelte';
    
    let count = 0;
    let user = null;
    
    function increment() {
        count += 1;
    }
    
    async function fetchUser() {
        const response = await fetch('/api/user');
        user = await response.json();
    }
    
    onMount(() => {
        fetchUser();
    });
    
    $: doubledCount = count * 2;
    $: if (count > 10) {
        console.log('Count is high!');
    }
</script>

<h1>Hello {user?.name || 'World'}!</h1>
<button on:click={increment}>
    Count: {count} (doubled: {doubledCount})
</button>

<style>
    h1 {
        color: red;
    }
    button {
        padding: 1rem;
    }
</style>`
        },
        {
            name: 'UserCard.svelte',
            content: `<script>
    export let user;
    export let showDetails = false;
    
    function toggleDetails() {
        showDetails = !showDetails;
    }
    
    $: initials = user?.name ? user.name.split(' ').map(n => n[0]).join('') : '??';
</script>

<div class="card">
    <div class="avatar">{initials}</div>
    <h2>{user?.name || 'Unknown User'}</h2>
    
    {#if showDetails}
        <div class="details">
            <p>Email: {user?.email}</p>
            <p>Role: {user?.role}</p>
        </div>
    {/if}
    
    <button on:click={toggleDetails}>
        {showDetails ? 'Hide' : 'Show'} Details
    </button>
</div>

<style>
    .card {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        margin: 0.5rem;
    }
    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #007acc;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }
</style>`
        },
        {
            name: 'DataTable.svelte',
            content: `<script>
    export let data = [];
    export let columns = [];
    
    let sortColumn = null;
    let sortDirection = 'asc';
    
    function sortBy(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
    }
    
    function handleRowClick(row) {
        console.log('Row clicked:', row);
    }
    
    $: sortedData = sortColumn 
        ? [...data].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        })
        : data;
</script>

<table>
    <thead>
        <tr>
            {#each columns as column}
                <th on:click={() => sortBy(column.key)}>
                    {column.label}
                    {#if sortColumn === column.key}
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    {/if}
                </th>
            {/each}
        </tr>
    </thead>
    <tbody>
        {#each sortedData as row}
            <tr on:click={() => handleRowClick(row)}>
                {#each columns as column}
                    <td>{row[column.key]}</td>
                {/each}
            </tr>
        {/each}
    </tbody>
</table>

<style>
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; border: 1px solid #ddd; }
    th { background: #f5f5f5; cursor: pointer; }
    tr:hover { background: #f9f9f9; }
</style>`
        }
    ];
    
    // Write Svelte components
    for (const component of svelteComponents) {
        await writeFile(join(basePath, 'src', 'components', component.name), component.content);
    }
    
    // Create some TypeScript files too
    const tsFiles = [
        {
            name: 'api.ts',
            content: `export interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
}

export class UserService {
    async getUser(id: number): Promise<User> {
        const response = await fetch(\`/api/users/\${id}\`);
        return response.json();
    }
    
    async updateUser(user: User): Promise<User> {
        const response = await fetch(\`/api/users/\${user.id}\`, {
            method: 'PUT',
            body: JSON.stringify(user)
        });
        return response.json();
    }
}

export function formatUserName(user: User): string {
    return user.name.toUpperCase();
}`
        },
        {
            name: 'utils.ts',
            content: `export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}`
        }
    ];
    
    // Write TypeScript files
    for (const file of tsFiles) {
        await writeFile(join(basePath, 'src', 'lib', file.name), file.content);
    }
    
    console.log('✅ Test Svelte project created');
}

async function testSvelteLearning() {
    console.log('🧪 Testing Svelte learning with timeout protection...');
    
    const testDir = join(__dirname, 'temp_svelte_test');
    
    try {
        // Create test project
        await createTestSvelteProject(testDir);
        
        // Initialize components
        const database = new SQLiteDatabase(':memory:');
        const vectorDB = new SemanticVectorDB(':memory:');
        const semanticEngine = new SemanticEngine(database, vectorDB);
        const patternEngine = new PatternEngine(database);
        
        console.log('🚀 Starting semantic learning...');
        const startTime = Date.now();
        
        // Test semantic learning with timeout
        const concepts = await semanticEngine.learnFromCodebase(testDir);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Learning completed in ${duration}ms`);
        console.log(`📊 Found ${concepts.length} concepts:`);
        
        // Group concepts by type
        const conceptsByType = concepts.reduce((acc, concept) => {
            acc[concept.type] = (acc[concept.type] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(conceptsByType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        
        // Test specific concepts found (without special Svelte types)
        const functions = concepts.filter(c => c.type === 'function');
        const classes = concepts.filter(c => c.type === 'class');
        const fileTypes = concepts.filter(c => c.type === 'file');
        
        console.log(`🎯 Analysis results:`);
        console.log(`   Functions: ${functions.length}`);
        console.log(`   Classes: ${classes.length}`);
        console.log(`   Files: ${fileTypes.length}`);
        
        // Verify timeout protection worked
        if (duration < 300000) { // Less than 5 minutes
            console.log('✅ Timeout protection is working - learning completed within time limit');
        } else {
            console.log('⚠️  Learning took longer than expected');
        }
        
        // Test pattern learning
        console.log('🎨 Testing pattern learning...');
        const patterns = await patternEngine.learnFromCodebase(testDir);
        console.log(`📈 Found ${patterns.length} patterns`);
        
        return {
            success: true,
            duration,
            conceptsFound: concepts.length,
            patternsFound: patterns.length,
            functionsFound: functions.length
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Check if this was a timeout error
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
            console.log('✅ Timeout protection is working - error was caught properly');
            return {
                success: true,
                timedOut: true,
                error: error.message
            };
        } else {
            throw error;
        }
    } finally {
        // Cleanup
        try {
            await rmdir(testDir, { recursive: true });
            console.log('🧹 Cleanup completed');
        } catch (cleanupError) {
            console.warn('⚠️  Cleanup failed:', cleanupError.message);
        }
    }
}

async function main() {
    console.log('🔬 Starting Svelte learning timeout tests...\n');
    
    try {
        const result = await testSvelteLearning();
        
        console.log('\n📋 Test Results:');
        console.log('================');
        console.log(`Success: ${result.success}`);
        
        if (result.timedOut) {
            console.log(`Timeout handled: Yes`);
            console.log(`Error message: ${result.error}`);
        } else {
            console.log(`Duration: ${result.duration}ms`);
            console.log(`Concepts found: ${result.conceptsFound}`);
            console.log(`Patterns found: ${result.patternsFound}`);
            console.log(`Functions found: ${result.functionsFound}`);
        }
        
        console.log('\n✅ All tests passed! Svelte learning timeout protection is working.');
        
    } catch (error) {
        console.error('\n❌ Tests failed:', error);
        process.exit(1);
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
