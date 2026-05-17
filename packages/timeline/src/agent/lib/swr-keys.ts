export const agentSWRKeys = {
  acquiredAgents: '/api/agent/agents/acquired',
  configuredProviders: '/settings/api-keys',
  sessionHistory: (limit: number) => `/api/agent/sessions?limit=${limit}`,
  agentSearch: (query: string) => `/api/agent/agents/search?q=${encodeURIComponent(query.trim())}`,
} as const;
