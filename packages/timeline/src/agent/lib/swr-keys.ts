export const agentSWRKeys = {
  acquiredAgents: 'agentime:agents:acquired',
  configuredProviders: 'agentime:credentials',
  sessionHistory: (limit: number) => `agentime:sessions:${limit}`,
  agentSearch: (query: string) => `agentime:agents:search:${query.trim()}`,
} as const;
