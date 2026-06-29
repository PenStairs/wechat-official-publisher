import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

fs.rmSync("dist", { recursive: true, force: true });

const tscCli = require.resolve("typescript/bin/tsc");
const result = spawnSync(process.execPath, [tscCli, "-p", "tsconfig.build.json"], {
  stdio: "inherit"
});

if (result.error) {
  console.error(`[build] TypeScript compiler failed to start: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (process.platform !== "win32") {
  fs.chmodSync("dist/cli.js", 0o755);
}
