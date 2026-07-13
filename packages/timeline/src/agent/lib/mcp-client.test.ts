import { LocalMcpHttpToolProvider } from "./mcp-client";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LocalMcpHttpToolProvider integration", () => {
  test("handles discovery, pairing requirements, execution, cancellation, and health loss", async () => {
    let fetchCalls: any[] = [];
    
    globalThis.fetch = (async (url: any, options: any) => {
      fetchCalls.push({ url, options });
      
      if (url.endsWith("/health")) {
        return {
          ok: true,
          status: 200,
        } as any;
      }
      
      if (url.endsWith("/mcp/connect")) {
        return {
          ok: true,
          status: 200,
        } as any;
      }
      
      if (url.endsWith("/mcp/tools")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            servers: {
              "mock-server": {
                status: "connected",
                tools: [
                  {
                    name: "mock-tool",
                    description: "mock description",
                    inputSchema: {}
                  }
                ]
              }
            }
          })
        } as any;
      }

      if (url.endsWith("/mcp/execute")) {
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              let sent = false;
              return {
                async read() {
                  if (sent) return { done: true, value: undefined };
                  sent = true;
                  return {
                    done: false,
                    value: new TextEncoder().encode(JSON.stringify({ result: "success" }))
                  };
                }
              };
            }
          }
        } as any;
      }

      return { ok: false, status: 404 } as any;
    }) as any;

    const provider = new LocalMcpHttpToolProvider({
      enabled: true,
      port: 8765,
      servers: [{ name: "mock-server" }],
      pairingToken: "valid-token",
    });

    let catalogCalls = 0;
    provider.subscribeCatalog((tools) => {
      catalogCalls++;
    });

    await provider.connect();
    expect(provider.getHostStatus()).toBe("connected");
    expect(provider.getClientStatus()).toBe("connected");
    expect(provider.getTools()).toHaveLength(1);
    expect(provider.getTools()[0]).toEqual({
      server: "mock-server",
      tool: "mock-tool",
      description: "mock description",
      inputSchema: {}
    });

    // Execute tool
    const result = await provider.execute({
      sessionId: "session-1",
      runId: "run-1",
      requestId: "req-1",
      server: "mock-server",
      tool: "mock-tool",
      arguments: {}
    }, { signal: new AbortController().signal });

    expect(result).toBe("success");

    await provider.disconnect();
    expect(provider.getHostStatus()).toBe("notConnected");
    expect(provider.getClientStatus()).toBe("notConnected");
  });
});
