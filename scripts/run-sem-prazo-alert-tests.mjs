import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "dist-test");
const tscCli = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");
const compiledTestFile = path.join(rootDir, "dist-test", "tests", "semPrazoAlerts.test.js");

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
      exitCode = run(process.execPath, ["--test", compiledTestFile]);
    }
  }
} finally {
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
}

process.exit(exitCode);
