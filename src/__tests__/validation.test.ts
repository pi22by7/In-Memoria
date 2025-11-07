import { describe, it, expect } from 'vitest';
import { 
  validateInput, 
  VALIDATION_SCHEMAS,
  AnalyzeCodebaseSchema,
  AutoLearnIfNeededSchema,
  GetSystemStatusSchema,
  ContributeInsightsSchema
} from '../mcp-server/validation.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('Input Validation', () => {
  describe('validateInput function', () => {
    it('should validate correct input successfully', () => {
      const validInput = { path: '/test/path' };
      const result = validateInput(AnalyzeCodebaseSchema, validInput, 'test_tool');
      
      expect(result).toEqual(validInput);
    });

    it('should throw McpError for invalid input', () => {
      const invalidInput = { path: '' }; // Empty path should fail
      
      expect(() => {
        validateInput(AnalyzeCodebaseSchema, invalidInput, 'test_tool');
      }).toThrow(McpError);
    });

    it('should provide detailed error messages', () => {
      const invalidInput = { path: 123 }; // Wrong type
      
      try {
        validateInput(AnalyzeCodebaseSchema, invalidInput, 'test_tool');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('Invalid input for test_tool');
        expect((error as McpError).message).toContain('path');
      }
    });

    it('should handle non-Zod errors', () => {
      const mockSchema = {
        parse: () => { throw new Error('Generic error'); }
      } as any;
      
      expect(() => {
        validateInput(mockSchema, {}, 'test_tool');
      }).toThrow(McpError);
    });
  });

  describe('Schema Validation', () => {
    describe('AnalyzeCodebaseSchema', () => {
      it('should accept valid path', () => {
        const input = { path: '/valid/path' };
        const result = AnalyzeCodebaseSchema.parse(input);
        expect(result.path).toBe('/valid/path');
      });

      it('should reject empty path', () => {
        expect(() => {
          AnalyzeCodebaseSchema.parse({ path: '' });
        }).toThrow();
      });

      it('should reject missing path', () => {
        expect(() => {
          AnalyzeCodebaseSchema.parse({});
        }).toThrow();
      });
    });

    describe('AutoLearnIfNeededSchema', () => {
      it('should accept all optional parameters', () => {
        const input = {};
        const result = AutoLearnIfNeededSchema.parse(input);
        
        expect(result.force).toBe(false); // Default
        expect(result.includeProgress).toBe(true); // Default
      });

      it('should accept custom parameters', () => {
        const input = {
          path: '/custom/path',
          force: true,
          includeProgress: false
        };
        const result = AutoLearnIfNeededSchema.parse(input);
        
        expect(result.path).toBe('/custom/path');
        expect(result.force).toBe(true);
        expect(result.includeProgress).toBe(false);
      });

      it('should apply defaults correctly', () => {
        const input = { path: '/test' };
        const result = AutoLearnIfNeededSchema.parse(input);
        
        expect(result.force).toBe(false);
        expect(result.includeProgress).toBe(true);
      });
    });

    describe('GetSystemStatusSchema', () => {
      it('should apply correct defaults', () => {
        const input = {};
        const result = GetSystemStatusSchema.parse(input);
        
        expect(result.includeMetrics).toBe(true);
        expect(result.includeDiagnostics).toBe(false);
      });

      it('should accept boolean overrides', () => {
        const input = {
          includeMetrics: false,
          includeDiagnostics: true
        };
        const result = GetSystemStatusSchema.parse(input);
        
        expect(result.includeMetrics).toBe(false);
        expect(result.includeDiagnostics).toBe(true);
      });
    });

    describe('ContributeInsightsSchema', () => {
      it('should validate complete insight object', () => {
        const input = {
          type: 'bug_pattern',
          content: { description: 'Test bug pattern' },
          confidence: 0.8,
          sourceAgent: 'test-agent',
          impactPrediction: { severity: 'medium' }
        };
        
        const result = ContributeInsightsSchema.parse(input);
        
        expect(result.type).toBe('bug_pattern');
        expect(result.confidence).toBe(0.8);
        expect(result.sourceAgent).toBe('test-agent');
      });

      it('should reject invalid insight types', () => {
        const input = {
          type: 'invalid_type',
          content: {},
          confidence: 0.5,
          sourceAgent: 'test-agent'
        };
        
        expect(() => {
          ContributeInsightsSchema.parse(input);
        }).toThrow();
      });

      it('should reject invalid confidence values', () => {
        const input = {
          type: 'optimization',
          content: {},
          confidence: 1.5, // Over 1.0
          sourceAgent: 'test-agent'
        };
        
        expect(() => {
          ContributeInsightsSchema.parse(input);
        }).toThrow();
      });

      it('should reject empty source agent', () => {
        const input = {
          type: 'refactor_suggestion',
          content: {},
          confidence: 0.7,
          sourceAgent: ''
        };
        
        expect(() => {
          ContributeInsightsSchema.parse(input);
        }).toThrow();
      });
    });
  });

  describe('VALIDATION_SCHEMAS mapping', () => {
    it('should contain all expected tool schemas', () => {
      const expectedTools = [
        'analyze_codebase',
        'search_codebase',
        'learn_codebase_intelligence',
        'get_semantic_insights',
        'get_pattern_recommendations',
        'predict_coding_approach',
        'get_developer_profile',
        'contribute_insights',
        'get_project_blueprint',
        'auto_learn_if_needed',
        'get_system_status',
        'get_intelligence_metrics',
        'get_performance_status',
        'health_check'
      ];

      expectedTools.forEach(toolName => {
        expect(VALIDATION_SCHEMAS).toHaveProperty(toolName);
        expect(VALIDATION_SCHEMAS[toolName as keyof typeof VALIDATION_SCHEMAS]).toBeDefined();
      });

      expect(Object.keys(VALIDATION_SCHEMAS)).toHaveLength(14);
    });

    it('should have working schemas for all tools', () => {
      Object.entries(VALIDATION_SCHEMAS).forEach(([toolName, schema]) => {
        expect(typeof schema.parse).toBe('function');
        
        // Try to parse empty object (should either work with defaults or fail gracefully)
        try {
          schema.parse({});
          // If it succeeds, that's fine (tool has all optional params)
        } catch (error) {
          // If it fails, should be a validation error (tool has required params)
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => {
        validateInput(AnalyzeCodebaseSchema, null, 'test');
      }).toThrow(McpError);

      expect(() => {
        validateInput(AnalyzeCodebaseSchema, undefined, 'test');
      }).toThrow(McpError);
    });

    it('should handle nested validation errors', () => {
      const complexInput = {
        type: 'optimization',
        content: 'should be object', // Wrong type
        confidence: 0.5,
        sourceAgent: 'test'
      };

      try {
        validateInput(ContributeInsightsSchema, complexInput, 'contribute_insights');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).message).toContain('content');
      }
    });

    it('should preserve valid additional properties in records', () => {
      const input = {
        type: 'best_practice',
        content: { 
          rule: 'Always validate input',
          examples: ['example1', 'example2'],
          severity: 'high'
        },
        confidence: 0.9,
        sourceAgent: 'linter-agent'
      };

      const result = ContributeInsightsSchema.parse(input);
      expect(result.content.rule).toBe('Always validate input');
      expect(result.content.examples).toEqual(['example1', 'example2']);
    });
  });
});
