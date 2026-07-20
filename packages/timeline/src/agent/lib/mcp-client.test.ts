import { LocalMcpHttpToolProvider } from "./mcp-client";
import type { LocalMcpProblem } from "../problems/types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LocalMcpHttpToolProvider integration", () => {
  test("handles discovery, pairing requirements, execution, cancellation, and health loss", async () => {
    const fetchCalls: any[] = [];
    
    globalThis.fetch = (async (url: any, options: any) => {
      fetchCalls.push({ url, options });
      
      if (url.endsWith("/health")) {
        return new Response(null, { status: 200 });
      }
      
      if (url.endsWith("/mcp/connect")) {
        return new Response(null, { status: 200 });
      }
      
      if (url.endsWith("/mcp/tools")) {
        return Response.json({
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
        });
      }

      if (url.endsWith("/mcp/execute")) {
        return Response.json({ result: "success" });
      }

      return new Response(null, { status: 404 });
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
    expect(fetchCalls.every(({ url }) => String(url).startsWith('http://127.0.0.1:8765/'))).toBe(true);

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

  test("rejects unsafe configuration, pre-cancelled execution, and oversized responses", async () => {
    expect(() => new LocalMcpHttpToolProvider({
      enabled: true,
      port: '8765@remote.example' as unknown as number,
      servers: [],
      pairingToken: 'token',
    })).toThrow('port');
    expect(() => new LocalMcpHttpToolProvider({
      enabled: true,
      port: 8765,
      servers: [{ name: '../escape' }],
      pairingToken: 'token',
    })).toThrow('identifiers');

    globalThis.fetch = (async (url: string, options?: RequestInit) => {
      if (url.endsWith('/mcp/execute')) {
        if (options?.signal?.aborted) throw options.signal.reason;
        return new Response('{}', { headers: { 'content-length': '5000001' } });
      }
      if (url.endsWith('/health') || url.endsWith('/mcp/connect')) {
        return new Response(null, { status: 200 });
      }
      if (url.endsWith('/mcp/tools')) {
        return Response.json({ servers: {} });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const problems: LocalMcpProblem[] = [];
    const provider = new LocalMcpHttpToolProvider({
      enabled: true,
      port: 8765,
      servers: [],
      pairingToken: 'token',
    }, undefined, (problem) => problems.push(problem));
    await provider.connect();
    const call = {
      sessionId: 'session', runId: 'run', requestId: 'request',
      server: 'fixture', tool: 'tool', arguments: {},
    };
    const cancelled = new AbortController();
    cancelled.abort(new DOMException('Cancelled', 'AbortError'));
    await expect(provider.execute(call, { signal: cancelled.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(provider.execute(call, { signal: new AbortController().signal }))
      .rejects.toThrow('size limit');
    expect(problems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'local-mcp:execution:fixture',
        code: 'MCP_EXECUTION_FAILED',
        operation: 'execution',
        server: 'fixture',
      }),
    ]));
    await provider.disconnect();
  });

  test("publishes bounded pairing and registration status for the settings surface", async () => {
    const problems: LocalMcpProblem[] = [];
    const unpaired = new LocalMcpHttpToolProvider({
      enabled: true,
      port: 8765,
      servers: [],
    }, undefined, (problem) => problems.push(problem));
    await expect(unpaired.connect()).rejects.toThrow('pairing token');
    expect(problems).toEqual([
      expect.objectContaining({
        id: 'local-mcp:configuration:host',
        code: 'MCP_PAIRING_REQUIRED',
        operation: 'configuration',
        retryable: false,
        recoveryActions: ['inspect_mcp_configuration'],
      }),
    ]);

    globalThis.fetch = jest.fn().mockRejectedValue(
      new Error('private browser network detail'),
    ) as typeof fetch;
    const unavailable = new LocalMcpHttpToolProvider({
      enabled: true,
      port: 8765,
      servers: [{ name: 'fixture' }],
      pairingToken: 'paired',
    }, undefined, (problem) => problems.push(problem));
    await expect(unavailable.connect()).rejects.toThrow('private browser network detail');
    expect(problems.at(-1)).toEqual(expect.objectContaining({
      id: 'local-mcp:registration:host',
      code: 'MCP_HOST_UNAVAILABLE',
      message: 'The local MCP host could not be reached or initialized.',
      operation: 'registration',
    }));
    expect(JSON.stringify(problems)).not.toContain('private browser network detail');
    await unavailable.disconnect();
  });
});
