/**
 * Gemini API File URI Tests
 * 
 * Tests whether Gemini can read file URIs in different contexts:
 * - Inside function responses (hypothesis: NO)
 * - As content parts (hypothesis: YES)
 * 
 * To run:
 * npm test gemini-file-uri.test
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleGenAI, type FunctionDeclaration, createPartFromUri, createUserContent } from '@google/genai';

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
// Configuration
// ============================================================

// Update this with a fresh file URI from upload_to_gemini.py
// Files expire after 48 hours
const TEST_FILE_URI = 'https://generativelanguage.googleapis.com/v1beta/files/ni9b0ryp1cbp';

// ============================================================
// Test Cases
// ============================================================

describe('Gemini API - File URI Handling', () => {
  
  it('should use createPartFromUri in function response', async () => {
    const getImageDeclaration: FunctionDeclaration = {
      name: 'get_image',
      description: 'Retrieves an image for analysis',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          image_id: {
            type: 'string',
            description: 'The image identifier'
          }
        },
        required: ['image_id']
      }
    };

    // Simulate: user asks to analyze image -> model calls get_image -> we return file as content part
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Please analyze the image with id "test-123" and describe what you see.' }]
        },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'get_image',
                args: { image_id: 'test-123' }
              }
            }
          ]
        },
        {
          role: 'tool',
          parts: [
            {
              functionResponse: {
                name: 'get_image',
                response: {
                  status: 'success',
                  message: 'Image retrieved successfully'
                }
              },
            },
            createPartFromUri(TEST_FILE_URI, 'image/webp')
          ]
        },
      ],
      config: {
        tools: [{ functionDeclarations: [getImageDeclaration] }]
      }
    });

    console.log('\n=== Function Response with createPartFromUri Test ===');
    console.log('Response text:', response.text);

    expect(response.text).toBeDefined();
    expect(response.text?.length).toBeGreaterThan(20);
  });
});
