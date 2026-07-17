'use client';

import { AgentimeHttpClient } from '@agentime/client';

export const agentimeHttp = new AgentimeHttpClient({
  baseUrl: '/api/agent',
  fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
});
