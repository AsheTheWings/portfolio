import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const consumerRoot = join(root, "packages", "timeline");
const consumerManifestPath = join(consumerRoot, "package.json");
const trackedDependencyFiles = [
  join(root, "package.json"),
  consumerManifestPath,
  join(root, "bun.lock"),
] as const;
const packageNames = [
  "@agentime/protocol",
  "@agentime/client",
] as const;

type PackageName = typeof packageNames[number];
type DependencyMode = "linked" | "registry";

interface InstalledPackage {
  name: PackageName;
  mode: DependencyMode;
  target: string;
  version: string;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function dependencySnapshot(): Map<string, string> {
  return new Map(trackedDependencyFiles.map((path) => [path, sha256(path)]));
}

function assertDependencyFilesUnchanged(before: Map<string, string>): void {
  const changed = trackedDependencyFiles
    .filter((path) => before.get(path) !== sha256(path))
    .map((path) => relative(root, path));
  if (changed.length > 0) {
    throw new Error(
      `Agentime dependency mode changed tracked files: ${changed.join(", ")}`,
    );
  }
}

function run(command: string[], cwd = root): void {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command.join(" ")} failed with exit code ${result.exitCode}`,
    );
  }
}

function declaredVersions(): Record<PackageName, string> {
  const manifest = JSON.parse(readFileSync(consumerManifestPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const versions = {} as Record<PackageName, string>;
  for (const name of packageNames) {
    const version = manifest.dependencies?.[name];
    if (
      typeof version !== "string"
      || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
    ) {
      throw new Error(`${name} must remain an exact registry version`);
    }
    versions[name] = version;
  }
  return versions;
}

function installedPackage(name: PackageName): InstalledPackage {
  const installedPath = join(consumerRoot, "node_modules", ...name.split("/"));
  if (!existsSync(installedPath)) {
    throw new Error(`${name} is not installed; run bun run agentime:registry`);
  }
  const target = realpathSync(installedPath);
  const manifestPath = join(target, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`${name} resolves to a package without package.json`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name?: string;
    version?: string;
  };
  if (manifest.name !== name || typeof manifest.version !== "string") {
    throw new Error(`${name} resolves to an invalid package identity`);
  }
  if (!existsSync(join(target, "dist", "index.js"))) {
    throw new Error(`${name} has no built dist/index.js`);
  }
  const insidePortfolio = target === root || target.startsWith(`${root}${sep}`);
  return {
    name,
    mode: insidePortfolio ? "registry" : "linked",
    target,
    version: manifest.version,
  };
}

function inspectPair(): {
  mode: DependencyMode;
  packages: InstalledPackage[];
} {
  const versions = declaredVersions();
  const packages = packageNames.map(installedPackage);
  const modes = new Set(packages.map((entry) => entry.mode));
  if (modes.size !== 1) {
    throw new Error(
      "Agentime dependency state is mixed; restore registry mode before linking again",
    );
  }
  const mode = packages[0]!.mode;
  if (mode === "registry") {
    for (const entry of packages) {
      if (entry.version !== versions[entry.name]) {
        throw new Error(
          `${entry.name} installed ${entry.version}, expected ${versions[entry.name]}`,
        );
      }
    }
  } else {
    const sourceParents = new Set(packages.map((entry) => dirname(entry.target)));
    const sourceVersions = new Set(packages.map((entry) => entry.version));
    if (sourceParents.size !== 1 || sourceVersions.size !== 1) {
      throw new Error(
        "Linked Agentime protocol and client must come from one coordinated source workspace",
      );
    }
  }
  return { mode, packages };
}

function printStatus(requiredMode?: DependencyMode): void {
  const state = inspectPair();
  for (const entry of state.packages) {
    const target = entry.mode === "linked"
      ? entry.target
      : relative(root, entry.target);
    console.log(
      `[agentime] ${entry.mode} ${entry.name}@${entry.version} -> ${target}`,
    );
  }
  if (requiredMode && state.mode !== requiredMode) {
    throw new Error(
      `Agentime dependencies are ${state.mode}; ${requiredMode} mode is required`,
    );
  }
}

function restoreRegistry(before: Map<string, string>): void {
  run(["bun", "install", "--frozen-lockfile", "--force"]);
  printStatus("registry");
  assertDependencyFilesUnchanged(before);
}

function linkPackages(): void {
  const before = dependencySnapshot();
  try {
    run(["bun", "link", "--no-save", ...packageNames]);
    for (const name of packageNames) {
      const rootLink = join(root, "node_modules", ...name.split("/"));
      const target = realpathSync(rootLink);
      const consumerLink = join(
        consumerRoot,
        "node_modules",
        ...name.split("/"),
      );
      rmSync(consumerLink, { force: true, recursive: true });
      mkdirSync(dirname(consumerLink), { recursive: true });
      symlinkSync(
        relative(dirname(consumerLink), target),
        consumerLink,
        "dir",
      );
    }
    printStatus("linked");
    assertDependencyFilesUnchanged(before);
  } catch (error) {
    try {
      restoreRegistry(before);
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        "Agentime linking failed and registry mode could not be restored",
      );
    }
    throw error;
  }
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "link":
      if (args.length !== 0) throw new Error("link accepts no arguments");
      linkPackages();
      break;
    case "registry":
      if (args.length !== 0) throw new Error("registry accepts no arguments");
      restoreRegistry(dependencySnapshot());
      break;
    case "status": {
      let requiredMode: DependencyMode | undefined;
      if (args.length === 2 && args[0] === "--require") {
        if (args[1] !== "linked" && args[1] !== "registry") {
          throw new Error("--require must be linked or registry");
        }
        requiredMode = args[1];
      } else if (args.length !== 0) {
        throw new Error("status accepts only --require linked|registry");
      }
      printStatus(requiredMode);
      break;
    }
    default:
      throw new Error(
        "Usage: bun run agentime:<link|status|registry>",
      );
  }
} catch (error) {
  console.error(
    `[agentime] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
