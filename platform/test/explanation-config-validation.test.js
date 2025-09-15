import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const explanationConfigPath = path.resolve('./src/explanation.json');
let explanationConfig;

beforeAll(() => {
  const rawData = fs.readFileSync(explanationConfigPath, 'utf8');
  explanationConfig = JSON.parse(rawData);
});

describe('Explanation Configuration Schema Validation', () => {
  
  describe('Basic Structure and Required Fields', () => {
    it('should have all required fields', () => {
      expect(explanationConfig).toHaveProperty('explanation_trigger');
      expect(explanationConfig).toHaveProperty('explanation_engine');
    });

    it('should be a valid object', () => {
      expect(explanationConfig).toBeTypeOf('object');
      expect(explanationConfig).not.toBeNull();
    });

    it('should not have additional unexpected properties', () => {
      const allowedProperties = [
        'explanation_trigger',
        'explanation_engine',
        'external_explanation_engine',
        'integrated_explanation_engine',
        'explanation_rating',
        'allow_user_message'
      ];
      
      const actualProperties = Object.keys(explanationConfig);
      actualProperties.forEach(prop => {
        expect(allowedProperties, `Unexpected property: ${prop}`).toContain(prop);
      });
    });
  });

  describe('Explanation Trigger Validation', () => {
    it('should have a valid explanation_trigger value', () => {
      expect(explanationConfig.explanation_trigger).toBeTypeOf('string');
      expect(['on_demand', 'automatic']).toContain(explanationConfig.explanation_trigger);
    });
  });

  describe('Explanation Engine Validation', () => {
    it('should have a valid explanation_engine value', () => {
      expect(explanationConfig.explanation_engine).toBeTypeOf('string');
      expect(['integrated', 'external']).toContain(explanationConfig.explanation_engine);
    });
  });

  describe('External Engine Configuration', () => {
    it('should have valid external_engine_type when present', () => {
      if (explanationConfig.external_engine_type !== undefined) {
        expect(explanationConfig.external_engine_type).toBeTypeOf('string');
        expect(['rest', 'ws']).toContain(explanationConfig.external_engine_type);
      }
    });

    it('should have valid external_explanation_engine_api when present', () => {
      if (explanationConfig.external_explanation_engine_api !== undefined) {
        expect(explanationConfig.external_explanation_engine_api).toBeTypeOf('string');
        
        // Basic URL validation
        expect(() => {
          new URL(explanationConfig.external_explanation_engine_api);
        }).not.toThrow();
        
        // Should not have trailing slash for API endpoint
        expect(explanationConfig.external_explanation_engine_api.endsWith('/')).toBe(false);
      }
    });

    it('should have valid external_explanation_engine when present', () => {
      if (explanationConfig.external_explanation_engine !== undefined) {
        expect(explanationConfig.external_explanation_engine).toBeTypeOf('object');
        expect(explanationConfig.external_explanation_engine).not.toBeNull();

        // Should have required properties
        if (explanationConfig.external_explanation_engine.external_engine_type !== undefined) {
          expect(['rest', 'ws']).toContain(explanationConfig.external_explanation_engine.external_engine_type);
        }

        if (explanationConfig.external_explanation_engine.external_explanation_engine_api !== undefined) {
          expect(explanationConfig.external_explanation_engine.external_explanation_engine_api).toBeTypeOf('string');
          // Basic URL validation
          expect(() => {
            new URL(explanationConfig.external_explanation_engine.external_explanation_engine_api);
          }).not.toThrow();
        }
      }
    });
  });

  describe('Integrated Engine Configuration', () => {
    it('should have valid integrated_explanation_engine when present', () => {
      if (explanationConfig.integrated_explanation_engine !== undefined) {
        expect(explanationConfig.integrated_explanation_engine).toBeTypeOf('object');
        expect(explanationConfig.integrated_explanation_engine).not.toBeNull();
        
        // Check that all keys follow the pattern ^[a-zA-Z0-9_]+$
        Object.keys(explanationConfig.integrated_explanation_engine).forEach(key => {
          expect(key, `Invalid key format: ${key}`).toMatch(/^[a-zA-Z0-9_]+$/);
        });
        
        // Check that all values are strings
        Object.values(explanationConfig.integrated_explanation_engine).forEach((value, index) => {
          const key = Object.keys(explanationConfig.integrated_explanation_engine)[index];
          expect(value, `Value for key ${key} should be string`).toBeTypeOf('string');
        });
      }
    });

    it('should have meaningful explanation texts', () => {
      if (explanationConfig.integrated_explanation_engine !== undefined) {
        Object.entries(explanationConfig.integrated_explanation_engine).forEach(([key, value]) => {
          expect(value, `Explanation text for ${key} should not be empty`).not.toBe('');
          expect(value.length, `Explanation text for ${key} should be meaningful`).toBeGreaterThan(5);
        });
      }
    });
  });

  describe('Optional Fields Validation', () => {
    it('should have valid explanation_rating when present', () => {
      if (explanationConfig.explanation_rating !== undefined) {
        expect(explanationConfig.explanation_rating).toBeTypeOf('string');
        expect(['like']).toContain(explanationConfig.explanation_rating);
      }
    });

    it('should have valid allow_user_message when present', () => {
      if (explanationConfig.allow_user_message !== undefined) {
        expect(explanationConfig.allow_user_message).toBeTypeOf('boolean');
      }
    });
  });

  describe('Conditional Schema Validation', () => {
    describe('External Engine Requirements', () => {
      it('should require external_explanation_engine when explanation_engine is external', () => {
        if (explanationConfig.explanation_engine === 'external') {
          expect(explanationConfig, 'external_explanation_engine is required when explanation_engine is external')
            .toHaveProperty('external_explanation_engine');
          expect(explanationConfig.external_explanation_engine).toBeTypeOf('object');

          // Should have both required properties
          expect(explanationConfig.external_explanation_engine).toHaveProperty('external_engine_type');
          expect(explanationConfig.external_explanation_engine).toHaveProperty('external_explanation_engine_api');
          expect(['rest', 'ws']).toContain(explanationConfig.external_explanation_engine.external_engine_type);
          expect(explanationConfig.external_explanation_engine.external_explanation_engine_api).toBeTypeOf('string');
        }
      });

    });

    describe('Integrated Engine Requirements', () => {
      it('should require integrated_explanation_engine when explanation_engine is integrated', () => {
        if (explanationConfig.explanation_engine === 'integrated') {
          expect(explanationConfig, 'integrated_explanation_engine is required when explanation_engine is integrated')
            .toHaveProperty('integrated_explanation_engine');
          expect(explanationConfig.integrated_explanation_engine).toBeTypeOf('object');
          
          // Should have at least one explanation
          expect(Object.keys(explanationConfig.integrated_explanation_engine).length)
            .toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Data Integrity Tests', () => {
    it('should have consistent configuration for current setup', () => {
      // Test the actual configuration in the file
      if (explanationConfig.explanation_engine === 'integrated') {
        expect(explanationConfig).toHaveProperty('integrated_explanation_engine');
        expect(Object.keys(explanationConfig.integrated_explanation_engine).length).toBeGreaterThan(0);
      }
      
      if (explanationConfig.explanation_engine === 'external') {
        expect(explanationConfig).toHaveProperty('external_explanation_engine');
        expect(explanationConfig.external_explanation_engine).toHaveProperty('external_engine_type');
        expect(explanationConfig.external_explanation_engine).toHaveProperty('external_explanation_engine_api');
      }
    });

    it('should have valid explanation IDs that could be referenced in game rules', () => {
      if (explanationConfig.integrated_explanation_engine !== undefined) {
        const explanationIds = Object.keys(explanationConfig.integrated_explanation_engine);
        
        // Check that explanation IDs follow a consistent pattern
        explanationIds.forEach(id => {
          expect(id, `Explanation ID ${id} should be descriptive`).toMatch(/^[a-zA-Z0-9_]+$/);
          expect(id.length, `Explanation ID ${id} should be meaningful length`).toBeGreaterThan(2);
        });
      }
    });

    it('should have appropriate explanation texts for different contexts', () => {
      if (explanationConfig.integrated_explanation_engine !== undefined) {
        Object.entries(explanationConfig.integrated_explanation_engine).forEach(([id, text]) => {
          // Check for potential HTML content (basic validation)
          if (text.includes('<') && text.includes('>')) {
            // If it contains HTML-like content, do basic validation
            expect(text, `HTML in explanation ${id} should be balanced`).not.toMatch(/<[^>]+$/);
          }
          
          // Check that explanations are informative
          expect(text, `Explanation ${id} should provide meaningful information`).toMatch(/\w+.*\w+/);
        });
      }
    });
  });

  describe('URL Format Validation', () => {
    it('should have properly formatted REST API URL when present', () => {
      if (explanationConfig.external_explanation_engine_api !== undefined) {
        const url = explanationConfig.external_explanation_engine_api;
        
        // Should be a valid URL
        expect(() => new URL(url)).not.toThrow();
        
        // Should use HTTP or HTTPS protocol
        const parsedUrl = new URL(url);
        expect(['http:', 'https:']).toContain(parsedUrl.protocol);
        
        // Should not end with slash (as specified in schema)
        expect(url.endsWith('/')).toBe(false);
      }
    });

    it('should have properly formatted WebSocket URL when present', () => {
      if (explanationConfig.external_explanation_engine !== undefined &&
          explanationConfig.external_explanation_engine.external_explanation_engine_api !== undefined) {
        const url = explanationConfig.external_explanation_engine.external_explanation_engine_api;

        // Should be a valid URL
        expect(() => new URL(url)).not.toThrow();

        // For WebSocket, could be ws:// or wss:// (or http/https for fallback)
        const parsedUrl = new URL(url);
        expect(['ws:', 'wss:', 'http:', 'https:']).toContain(parsedUrl.protocol);
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle mixed configuration (both external and integrated properties present)', () => {
      // The current file has both external and integrated properties
      // This should be valid as long as the required conditions are met for the active engine
      if (explanationConfig.explanation_engine === 'integrated' && 
          explanationConfig.external_explanation_engine_api !== undefined) {
        // This is allowed - external properties can be present but are ignored when using integrated engine
        expect(explanationConfig).toHaveProperty('integrated_explanation_engine');
      }
    });

    it('should validate that boolean fields have correct default behavior', () => {
      // allow_user_message should default to false if not specified, but when present should be boolean
      if (explanationConfig.allow_user_message !== undefined) {
        expect(explanationConfig.allow_user_message).toBeTypeOf('boolean');
      }
    });
  });
});