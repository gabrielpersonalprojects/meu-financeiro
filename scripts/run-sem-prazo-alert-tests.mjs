import { existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "dist-test");
const tscCli = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  return Number(result.status ?? 1);
};

let exitCode = 0;

try {
  if (!existsSync(tscCli)) {
    console.error("TypeScript CLI nao encontrada em node_modules. Execute npm install antes de rodar os testes.");
    exitCode = 1;
  } else {
    exitCode = run(process.execPath, [tscCli, "-p", "tsconfig.test.json"]);

    if (exitCode === 0) {
      const testsDir = path.join(outDir, "tests");
      const testFiles = existsSync(testsDir)
        ? readdirSync(testsDir)
            .filter((f) => f.endsWith(".test.js"))
            .map((f) => path.join(testsDir, f))
        : [];

      if (testFiles.length > 0) {
        exitCode = run(process.execPath, ["--test", ...testFiles]);
      }
    }
  }
} finally {
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
}

process.exit(exitCode);
