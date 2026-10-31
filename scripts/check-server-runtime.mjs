import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

// Vercel runs emitted ESM with Node. Loading it through tsx alone misses
// extensionless imports that compile but fail when a hosted function starts.
const scratchRoot = resolve(".supabase");
await mkdir(scratchRoot, { recursive: true });
const output = await mkdtemp(join(scratchRoot, "runtime-"));
try {
  const compilation = spawnSync(
    process.execPath,
    [
      resolve("node_modules/typescript/bin/tsc"),
      "-p", "tsconfig.server.json", "--noEmit", "false", "--outDir", output,
    ],
    { stdio: "inherit" },
  );
  if (compilation.error || compilation.status !== 0)
    throw new Error("Server TypeScript compilation failed");
  const handlers = (await readdir(join(output, "api"))).filter((f) => f.endsWith(".js"));
  if (!handlers.length) throw new Error("No compiled API handlers found");
  for (const file of handlers) {
    const handler = await import(pathToFileURL(join(output, "api", file)).href);
    if (typeof handler.default !== "function")
      throw new Error(`API handler has no default function: ${file}`);
  }
  console.log(`Server type check and ${handlers.length} emitted Node API imports passed.`);
} finally {
  if (!resolve(output).startsWith(scratchRoot + sep))
    throw new Error("Runtime check cleanup escaped the scratch directory");
  await rm(output, { recursive: true, force: true });
}
