import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const timelineSource = resolve(__dirname);
const portfolioRoot = resolve(timelineSource, '../../..');

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

describe('Agentime frontend boundaries', () => {
  it('never resolves or imports the private server package', async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(timelineSource)) {
      const source = await readFile(file, 'utf8');
      if (/from\s+["']@agentime\/server(?:\/[^"']*)?["']/.test(source)) {
        violations.push(relative(portfolioRoot, file));
      }
    }
    const packageManifest = await readFile(join(portfolioRoot, 'packages/timeline/package.json'), 'utf8');
    if (packageManifest.includes('"@agentime/server"')) violations.push('packages/timeline/package.json');
    expect(violations).toEqual([]);
  });

  it('uses exact public dependencies without an external workspace glob', async () => {
    const rootManifest = JSON.parse(await readFile(join(portfolioRoot, 'package.json'), 'utf8')) as {
      workspaces: string[];
    };
    expect(rootManifest.workspaces).toEqual(['apps/*', 'packages/*']);
    const manifest = JSON.parse(await readFile(join(portfolioRoot, 'packages/timeline/package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    for (const name of ['@agentime/client', '@agentime/protocol']) {
      expect(manifest.dependencies[name]).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    }
  });

  it('commits a registry-resolved lockfile with no deprecated or neighboring Agentime packages', async () => {
    const lockfile = await readFile(join(portfolioRoot, 'bun.lock'), 'utf8');
    expect(lockfile.includes('@agentime/agent')).toBe(false);
    expect(lockfile.includes('timeline-backend/dev/packages')).toBe(false);
    expect(/@agentime\/(?:client|protocol)@(?:workspace:|file:|git\+)/.test(lockfile)).toBe(false);
  });

  it('keeps local Agentime links ephemeral and restores registry mode for deployment', async () => {
    const rootManifest = JSON.parse(await readFile(join(portfolioRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(rootManifest.scripts['agentime:link']).toBe('bun run scripts/agentime-packages.ts link');
    expect(rootManifest.scripts['agentime:status']).toBe('bun run scripts/agentime-packages.ts status');
    expect(rootManifest.scripts['agentime:registry']).toBe('bun run scripts/agentime-packages.ts registry');

    const modeScript = await readFile(join(portfolioRoot, 'scripts/agentime-packages.ts'), 'utf8');
    expect(modeScript).toContain('"--no-save"');
    expect(modeScript).toContain('"--frozen-lockfile"');
    expect(modeScript).toContain('assertDependencyFilesUnchanged');
    expect(modeScript).toContain('"@agentime/protocol"');
    expect(modeScript).toContain('"@agentime/client"');
    expect(modeScript).toContain('Agentime dependency state is mixed');

    const deployment = await readFile(join(portfolioRoot, 'scripts/deploy.sh'), 'utf8');
    expect(deployment).toContain('bun run agentime:status --require registry');
  });

  it('resolves Agentime tests through published package outputs only', async () => {
    const jestConfig = await readFile(join(portfolioRoot, 'apps/portfolio/jest.config.js'), 'utf8');
    expect(jestConfig).not.toContain('@agentime/server');
    for (const mapping of ['@agentime/protocol', '@agentime/client']) {
      expect(jestConfig).toContain(mapping);
    }
    expect(jestConfig).not.toMatch(/@agentime\/(?:protocol|client)[^'"\n]*\/src\//);
    expect(jestConfig.match(/node_modules\/@agentime\/(?:protocol|client)\/dist\//g)?.length).toBe(3);
  });

  it('does not restore removed Agentime proxy or DTO implementations', async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(timelineSource)) {
      if (file === resolve(__dirname, 'architecture.test.ts')) continue;
      const source = await readFile(file, 'utf8');
      if (source.includes('/api/library') || source.includes('/api/settings')) {
        violations.push(relative(portfolioRoot, file));
      }
      if (/interface\s+(?:SavedAgent|LibraryAsset|LibraryFolder|WorkflowDescriptor|ToolDescriptor)\b/.test(source)) {
        violations.push(relative(portfolioRoot, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('does not restore removed public failure or WebSocket contracts', async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(timelineSource)) {
      if (file === resolve(__dirname, 'architecture.test.ts')) continue;
      const source = await readFile(file, 'utf8');
      for (const removed of [
        /\bAgentimeError\b/,
        /\bAgentExecutionErrorPayload\b/,
        /\bsession_created\b/,
        /\bworkflow_started_ack\b/,
      ]) {
        if (removed.test(source)) {
          violations.push(`${relative(portfolioRoot, file)} contains ${removed.source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
