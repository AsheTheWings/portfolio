/**
 * Performance tests for Session.callAgent execution speed.
 * 
 * To run:
 * npm test call-agent.test
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Session } from '../core/session';
import { SessionsManager } from '../core/sessions-manager';
import type { SessionMetadata, AgentConfig } from '../types';
import { userPrompts } from './prompts-registry';

// Load .env.local from test folder
dotenv.config({ path: path.join(__dirname, '.env.local') });

// ============================================================
// Test Configuration Constants
// ============================================================
const TEST_CONFIG = {
  provider: 'gemini',
  model: 'gemini-2.5-flash-lite',
  systemInstructions: 'You are a helpful coding assistant.',
  stream: true,
  temperature: 0,
  topP: 0.95,
  selectedNativeTools: [],
  enableThinking: false,
  includeThoughtsInResponse: false,
  includeThoughtsInContext: true,
  maxModelCalls: 5,
  enableTools: false,
  availableTools: [],
  maxConcurrentTools: 3,
  enableWorkflows: false,
  selectedWorkflows: [],
};

const SESSION_CONFIG = {
  title: 'TEST_CALL_AGENT',
  agentName: 'PerfAgent',
  persist: false,
  ephemeral: false,
};

const PERFORMANCE_THRESHOLDS = {
  avgExecutionTime: 100, // ms
};

// ============================================================
// Save original fetch to make real requests to backend
// ============================================================
const originalFetch = global.fetch;

// Mock fetch globally
global.fetch = jest.fn();

describe('Session Execution Performance', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(__dirname, 'logs', 'call-agent', `call-agent-${timestamp}.log`);
  
  // Clear log file at start
  beforeAll(() => {
    // Ensure logs directory exists
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(logFile, `Performance Test Run: ${new Date().toISOString()}\n\n`);
  });

  let session: Session;
  let sessionId: string;
  let authToken: string = '';
  
  const mockAgentConfig: AgentConfig = TEST_CONFIG as AgentConfig;

  beforeEach(async () => {
    // Reset mocks
    (global.fetch as jest.Mock).mockReset();
    
    // Authenticate using email/password to get a fresh JWT
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;
    
    if (email && password) {
      try {
        // Sign in with password
        const response = await originalFetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          authToken = data.access_token;
        } else {
          console.warn('Failed to login:', response.status, await response.text());
          authToken = '';
        }
      } catch (error) {
        console.warn('Login request failed:', error);
        authToken = '';
      }
    } else {
      console.warn('TEST_EMAIL/TEST_PASSWORD not set in .env.local');
      authToken = '';
    }
    
    // Setup fetch mock to handle both model stream and persistence
    (global.fetch as jest.Mock).mockImplementation(async (url: string, options: Record<string, unknown>) => {
      // Handle Session Creation API - Forward to REAL backend
      if (url.includes('/api/agent/sessions') && options?.method === 'POST' && !url.includes('/events')) {
        try {
          const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
          
          // Pass JWT via Authorization header
          const headersWithAuth = {
            ...options.headers,
            'Authorization': `Bearer ${authToken}`,
          };
          
          return await originalFetch(fullUrl, {
            ...options,
            headers: headersWithAuth,
          });
        } catch (error) {
          console.warn('Session creation failed:', error);
          return {
            ok: false,
            json: async () => ({ error: 'Session creation failed' }),
          };
        }
      }

      // Handle Persistence API - Forward to REAL backend with auth
      if (url.includes('/events') && options?.method === 'POST') {
        try {
          // Assume backend is running at localhost:3000
          const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
          
          // Pass JWT via Authorization header
          const headersWithAuth = {
            ...options.headers,
            'Authorization': `Bearer ${authToken}`,
          };
          
          const response = await originalFetch(fullUrl, {
            ...options,
            headers: headersWithAuth,
          });
          return response;
        } catch (error) {
          console.warn('Real persistence failed (is backend running?):', error);
          // Fallback to success to not break the test loop if backend is down
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
      }

      // Handle Model API (Stream)
      const stream = new ReadableStream({
        start(controller) {
          // Generate unique UUIDs for this response
          const generateUUID = () => crypto.randomUUID();
          const componentId = generateUUID();
          
          const events = [
            // 1. Thought start
            { type: 'model-thought-chunk', eventId: generateUUID(), componentId, data: { thought: 'Thinking about ' } },
            // 2. Thought continue
            { type: 'model-thought-chunk', eventId: generateUUID(), componentId, data: { thought: 'the request...' } },
            // 3. Thought complete
            { type: 'model-thought-completed', eventId: generateUUID(), componentId, data: { thought: 'Thinking about the request...', apiContents: {} } },
            // 4. Message chunk 1
            { type: 'model-message-chunk', eventId: generateUUID(), componentId: generateUUID(), data: { message: 'Here is ' } },
            // 5. Message chunk 2
            { type: 'model-message-chunk', eventId: generateUUID(), componentId: generateUUID(), data: { message: 'the solution.' } },
            // 6. Message complete
            { type: 'model-message-completed', eventId: generateUUID(), componentId: generateUUID(), data: { message: 'Here is the solution.', apiContents: {} } }
          ];

          // Enqueue events with "server-sent events" format
          for (const event of events) {
            const encoder = new TextEncoder();
            // SSE format: event: [type]\ndata: [json]\n\n
            const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        }
      });

      return {
        ok: true,
        body: stream,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        json: async () => ({}),
      };
    });

    // Create a real session using SessionsManager (now with fetch mock in place)
    const sessionsManager = new SessionsManager();
    const createdSession = await sessionsManager.createSession(
      {
        title: SESSION_CONFIG.title,
        agentName: SESSION_CONFIG.agentName,
      },
      { persist: SESSION_CONFIG.persist, ephemeral: SESSION_CONFIG.ephemeral }
    );
    
    session = createdSession;
    sessionId = session.metadata.sessionId || 'perf-test-session';
  }, 30000); // 30 second timeout for setup

  it('should track execution time of event yielding for 50 interactions', async () => {
    const totalStart = performance.now();
    const executionTimes: number[] = [];
    let eventLog = '';

    for (let i = 0; i < userPrompts.length; i++) {
      const prompt = userPrompts[i];
      
      // 1. Set user turn
      for await (const _ of session.setUserTurn(prompt, mockAgentConfig)) {
        // consume events
      }
      
      // 2. Call Agent and collect execution times
      for await (const event of session.callAgent()) {
        // Collect executionTime from events that have it
        const executionTime = (event.data as any).executionTime;
        if (executionTime !== undefined) {
          executionTimes.push(executionTime);
          eventLog += `[Turn ${i + 1}] ${event.type}: ${executionTime.toFixed(2)}ms\n`;
        } else {
          eventLog += `[Turn ${i + 1}] ${event.type}: (no timing)\n`;
        }
      }
    }

    const totalDuration = performance.now() - totalStart;
    const avgExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
      : 0;
    const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

    // Build configuration section
    const configSection = `=== Test Configuration ===
Session ID: ${sessionId}
Session Title: ${session.metadata.title}
Agent Name: ${session.metadata.agentName}
Model: ${mockAgentConfig.model}
Stream: ${mockAgentConfig.stream}
Enable Tools: ${mockAgentConfig.enableTools}
Enable Thinking: ${mockAgentConfig.enableThinking}
Max Model Calls: ${mockAgentConfig.maxModelCalls}
Max Concurrent Tools: ${mockAgentConfig.maxConcurrentTools}
Temperature: ${mockAgentConfig.temperature}
Top P: ${mockAgentConfig.topP}
Include Thoughts in Response: ${mockAgentConfig.includeThoughtsInResponse}
Include Thoughts in Context: ${mockAgentConfig.includeThoughtsInContext}
Persistence Enabled: ${SESSION_CONFIG.persist}
Ephemeral Mode: ${SESSION_CONFIG.ephemeral}
Total Prompts: ${userPrompts.length}
\n`;

    const summary = `=== Performance Summary ===
Total Duration: ${totalDuration.toFixed(2)}ms
Total Interactions: ${userPrompts.length}
Events with Timing: ${executionTimes.length}
Average Execution Time: ${avgExecutionTime.toFixed(2)}ms
Max Execution Time: ${maxExecutionTime.toFixed(2)}ms
\n`;
    
    // Write config and summary at top, then event log
    fs.writeFileSync(logFile, `Performance Test Run: ${new Date().toISOString()}\n\n${configSection}${summary}\n=== Event Log ===\n${eventLog}`);
    
    // Log raw execution times for analysis
    fs.appendFileSync(logFile, `\nRaw Execution Times (ms): ${executionTimes.join(', ')}\n`);

    // Assertions
    expect(avgExecutionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.avgExecutionTime); 
  }, 60000); // Increased timeout for 50 iterations
});
