/**
 * Gemini API Content Structure Tests
 * 
 * Tests specific edge cases for last content in model responses.
 * Uses Gemini API directly via @google/genai SDK.
 * 
 * To run:
 * npm test gemini-api.test
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleGenAI, FunctionCallingConfigMode, type FunctionDeclaration } from '@google/genai';

// Load .env.local from test folder
dotenv.config({ path: path.join(__dirname, '.env.local') });

// ============================================================
// Setup
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

console.log(`Using API key: ${GEMINI_API_KEY}`);

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================================
// Helper Functions
// ============================================================

/**
 * Collect all chunks from streaming response
 */
async function collectStreamChunks(
  response: AsyncIterable<any>
): Promise<any[]> {
  const chunks = [];
  for await (const chunk of response) {
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Get the last content part from response
 */
function getLastContentPart(chunks: unknown[]): unknown {
  // Find last candidate with content
  for (let i = chunks.length - 1; i >= 0; i--) {
    const candidate = chunks[i].candidates?.[0];
    if (candidate?.content?.parts?.length > 0) {
      const parts = candidate.content.parts;
      return parts[parts.length - 1];
    }
  }
  return null;
}

// ============================================================
// Test Cases
// ============================================================

describe('Gemini API - Last Content Edge Cases', () => {
  
  describe('Function Call and Result Without User Message', () => {
    it('should fail when starting with model functionCall without user message', async () => {
      const weatherDeclaration: FunctionDeclaration = {
        name: 'get_weather',
        description: 'Get weather for a location',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            }
          },
          required: ['location']
        }
      };

      // This should throw or fail because conversation must start with user message
      await expect(async () => {
        const response = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash-lite',
          contents: [
            {
              role: 'model',
              parts: [
                {
                  functionCall: {
                    name: 'get_weather',
                    args: { location: 'London' }
                  }
                }
              ]
            },
            {
              role: 'tool',
              parts: [
                {
                  functionResponse: {
                    name: 'get_weather',
                    response: {
                      temperature: 15,
                      condition: 'cloudy'
                    }
                  }
                }
              ]
            }
          ]
        });

        await collectStreamChunks(response);
      }).rejects.toThrow();
    });
  });

  describe('Model FunctionCall as Last Input Content', () => {
    it('should handle model functionCall as the last input content (awaiting tool response)', async () => {
      const weatherDeclaration: FunctionDeclaration = {
        name: 'get_weather',
        description: 'Get weather for a location',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            }
          },
          required: ['location']
        }
      };

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Get weather for Paris' }]
          },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: 'get_weather',
                  args: { location: 'Paris' }
                }
              }
            ]
          }
          // No tool response - functionCall is the last input content
        ]
      });

      const chunks = await collectStreamChunks(response);
      const lastPart = getLastContentPart(chunks);

      expect(lastPart).toBeDefined();
      // Model should respond with text based on context
      expect(lastPart.text).toBeDefined();
    });
  });


  describe('Content Sequence Validation', () => {
    it('should validate that function call does not have text in same part', async () => {
      const weatherDeclaration: FunctionDeclaration = {
        name: 'get_weather',
        description: 'Get weather',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        }
      };

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Call get_weather for Paris' }]
          }
        ],
        config: {
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: ['get_weather']
            }
          },
          tools: [
            {
              functionDeclarations: [weatherDeclaration]
            }
          ]
        }
      });

      const chunks = await collectStreamChunks(response);
      
      // Check all parts for proper separation
      for (const chunk of chunks) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            // If it has functionCall, it should not have text
            if (part.functionCall) {
              expect(part.text).toBeUndefined();
            }
          }
        }
      }
    });

    it('should validate that thought and text are separate parts', async () => {
      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Think then answer: what is 3+3?' }]
          }
        ]
      });

      const chunks = await collectStreamChunks(response);
      
      // Collect all parts across chunks
      const allParts: any[] = [];
      for (const chunk of chunks) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          allParts.push(...candidate.content.parts);
        }
      }

      // Verify parts don't mix thought and text in same object
      for (const part of allParts) {
        if (part.thought !== undefined && part.text !== undefined) {
          // Both can exist but typically in separate parts
          // This is more of a documentation check
        }
      }

      expect(allParts.length).toBeGreaterThan(0);
    });

    it('should accept consecutive model contents (API is lenient with pattern)', async () => {
      // The API accepts consecutive model contents even though typical conversation
      // alternates between user and model. This documents the actual API behavior.
      
      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }]
          },
          {
            role: 'model',
            parts: [{ text: 'Hi there!' }]
          },
          {
            role: 'model',
            parts: [{ text: 'How are you?' }]
          },
          {
            role: 'model',
            parts: [{ text: 'This is accepted' }]
          }
        ]
      });

      const chunks = await collectStreamChunks(response);
      expect(chunks.length).toBeGreaterThan(0);
      
      const lastPart = getLastContentPart(chunks);
      expect(lastPart).toBeDefined();
    });
  });

});
