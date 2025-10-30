/**
 * Mock data for testing
 */

export const mockSemanticConcept = {
    id: 'test-concept-1',
    conceptName: 'UserService',
    conceptType: 'class',
    confidenceScore: 0.95,
    relationships: {
        extends: [],
        implements: ['IUserService'],
        uses: ['User', 'Database'],
    },
    evolutionHistory: {
        versions: [
            {
                timestamp: new Date().toISOString(),
                changes: ['Initial creation'],
            },
        ],
    },
    filePath: './src/services/user.service.ts',
    lineRange: { start: 1, end: 50 },
};

export const mockDeveloperPattern = {
    id: 'pattern-1',
    patternType: 'architecture',
    description: 'Service layer pattern for business logic',
    frequency: 10,
    confidenceScore: 0.9,
    examples: [
        {
            filePath: './src/services/user.service.ts',
            lineRange: { start: 1, end: 50 },
        },
    ],
};

export const mockProjectBlueprint = {
    techStack: {
        languages: [
            { name: 'TypeScript', percentage: 85, fileCount: 120 },
            { name: 'JavaScript', percentage: 10, fileCount: 15 },
            { name: 'JSON', percentage: 5, fileCount: 8 },
        ],
        frameworks: ['Node.js', 'Express', 'React'],
        libraries: ['sqlite3', 'zod', 'vitest'],
    },
    entryPoints: [
        { path: './src/index.ts', type: 'main' },
        { path: './src/server.ts', type: 'server' },
    ],
    keyDirectories: [
        { path: './src/services', purpose: 'Business logic services' },
        { path: './src/storage', purpose: 'Database and storage layer' },
        { path: './src/mcp-server', purpose: 'MCP server implementation' },
    ],
    architectureOverview: 'Service-oriented architecture with clear separation of concerns',
    featureMap: {
        'User Management': ['./src/services/user.service.ts', './src/models/user.ts'],
        'Database Layer': ['./src/storage/sqlite-db.ts', './src/storage/schema.sql'],
    },
};

export const mockCodeAnalysis = {
    languages: ['TypeScript'],
    frameworks: ['Node.js'],
    complexity: {
        cognitive: 15,
        cyclomatic: 8,
        maintainability: 75,
    },
    topConcepts: [
        { name: 'UserService', type: 'class', confidence: 0.95 },
        { name: 'createUser', type: 'function', confidence: 0.9 },
        { name: 'User', type: 'interface', confidence: 0.85 },
    ],
    topPatterns: [
        { name: 'Async/Await Pattern', confidence: 0.9 },
        { name: 'Repository Pattern', confidence: 0.85 },
    ],
};

export const mockFileTree = {
    name: 'project',
    type: 'directory',
    children: [
        {
            name: 'src',
            type: 'directory',
            children: [
                {
                    name: 'index.ts',
                    type: 'file',
                    content: 'export * from "./services"',
                },
                {
                    name: 'services',
                    type: 'directory',
                    children: [
                        {
                            name: 'user.service.ts',
                            type: 'file',
                            content: mockSemanticConcept.filePath,
                        },
                    ],
                },
            ],
        },
        {
            name: 'package.json',
            type: 'file',
            content: JSON.stringify({ name: 'test-project', version: '1.0.0' }),
        },
    ],
};

export const mockDeveloperProfile = {
    namingConventions: {
        variables: 'camelCase',
        functions: 'camelCase',
        classes: 'PascalCase',
        constants: 'UPPER_SNAKE_CASE',
    },
    structuralPatterns: [
        'Service layer separation',
        'Repository pattern',
        'Dependency injection',
    ],
    testingApproach: {
        framework: 'vitest',
        coverage: 'unit + integration',
        style: 'AAA (Arrange-Act-Assert)',
    },
    expertiseAreas: ['Backend Development', 'TypeScript', 'Database Design'],
    recentActivity: {
        filesWorked: ['./src/services/user.service.ts', './src/storage/sqlite-db.ts'],
        features: ['User Management', 'Database Layer'],
    },
};

export const mockSearchResults = [
    {
        type: 'semantic',
        filePath: './src/services/user.service.ts',
        conceptName: 'UserService',
        snippet: 'export class UserService { ... }',
        relevanceScore: 0.95,
    },
    {
        type: 'text',
        filePath: './src/models/user.ts',
        conceptName: 'User',
        snippet: 'interface User { id: string; name: string; }',
        relevanceScore: 0.85,
    },
];

export const mockPatternRecommendations = [
    {
        pattern: 'Async/Await Pattern',
        description: 'Use async/await for asynchronous operations',
        confidence: 0.95,
        examples: [
            {
                filePath: './src/services/user.service.ts',
                lineRange: { start: 5, end: 10 },
                code: 'async createUser(userData: CreateUserRequest): Promise<User> { ... }',
            },
        ],
        relatedFiles: [
            './src/services/auth.service.ts',
            './src/services/post.service.ts',
        ],
    },
];

export const mockCodingApproach = {
    recommendedApproach: 'Create a new service class following the existing pattern',
    suggestedPatterns: ['Service Layer', 'Dependency Injection', 'Async/Await'],
    complexityEstimate: 'medium',
    fileRouting: {
        suggestedStartPoint: './src/services/new-feature.service.ts',
        relatedFiles: [
            './src/services/user.service.ts',
            './src/models/new-feature.ts',
        ],
    },
    implementationSteps: [
        'Create service interface',
        'Implement service class',
        'Add database methods',
        'Write unit tests',
    ],
};
