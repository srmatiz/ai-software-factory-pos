#!/usr/bin/env node
// PreToolUse hook for the test-verifier agent.
// Allows Edit/Write only on test files; exit code 2 blocks the call and the
// stderr message is shown to the agent.

import { existsSync } from "node:fs";
import path from "node:path";

// Repo-relative path patterns the test verifier may write.
const ALLOWED = [/^tests\/(e2e|integration|component|unit)\/.+\.(ts|tsx)$/];

// Allowed by the pattern above but still off limits: shared test infrastructure.
const BLOCKED = [[/^tests\/integration\/global-setup\.ts$/, "the integration global setup is shared infrastructure"]];

const input = JSON.parse(await readStdin());
const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? "";
const base = input?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const abs = path.resolve(base, filePath);
const root = repoRoot(abs) ?? base;
const rel = path.relative(root, abs).split(path.sep).join("/");

const error = check(rel);
if (error) {
  process.stderr.write(
    `Blocked (test-verifier): ${error}. Allowed: tests/e2e/**, tests/integration/**, tests/component/**, tests/unit/** (.ts/.tsx). ` +
      `Never change application code to make a test pass; report the failing criterion instead.\n`,
  );
  process.exit(2);
}
process.exit(0);

function check(p) {
  if (!p || p.startsWith("..")) return `"${filePath}" is outside the repository`;
  for (const [re, why] of BLOCKED) if (re.test(p)) return why;
  if (!ALLOWED.some((re) => re.test(p))) return `"${p}" is not a test file`;
  return null;
}

// Nearest ancestor with a .git entry (a directory, or a file in a git worktree),
// so the hook also works when the agent runs in a worktree.
function repoRoot(file) {
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    if (dir === path.dirname(dir)) return null;
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
