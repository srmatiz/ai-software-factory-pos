#!/usr/bin/env node
// PreToolUse hook for the frontend-builder agent.
// Allows Edit/Write only on frontend files; exit code 2 blocks the call and
// the stderr message is shown to the agent.

import { existsSync } from "node:fs";
import path from "node:path";

// Repo-relative path patterns the frontend builder may write.
const ALLOWED = [
  /^src\/app\/.+\.(tsx|ts|css)$/,
  /^src\/components\/.+\.(tsx|ts)$/,
  /^src\/hooks\/.+\.(tsx|ts)$/,
  /^src\/lib\/utils\.ts$/,
  /^src\/lib\/barcode-scanner\.ts$/,
  /^public\/.+$/,
  /^tests\/(component|e2e)\/.+\.(tsx|ts)$/,
  /^tests\/unit\/.+\.test\.ts$/,
];

// Allowed by the patterns above but still off limits: the backend contract.
const BLOCKED = [
  [/^src\/app\/(.+\/)?actions\.ts$/, "server actions belong to backend-builder; consume them as they are"],
  [/^src\/app\/api\//, "route handlers belong to backend-builder"],
];

const input = JSON.parse(await readStdin());
const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? "";
const base = input?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const abs = path.resolve(base, filePath);
const root = repoRoot(abs) ?? base;
const rel = path.relative(root, abs).split(path.sep).join("/");

const error = check(rel);
if (error) {
  process.stderr.write(
    `Blocked (frontend-builder): ${error}. Allowed: src/app/** (except actions.ts and api/), src/components/**, ` +
      `src/hooks/**, src/lib/utils.ts, src/lib/barcode-scanner.ts, public/**, tests/component/**, tests/e2e/**, tests/unit/**.\n`,
  );
  process.exit(2);
}
process.exit(0);

function check(p) {
  if (!p || p.startsWith("..")) return `"${filePath}" is outside the repository`;
  for (const [re, why] of BLOCKED) if (re.test(p)) return why;
  if (!ALLOWED.some((re) => re.test(p))) return `"${p}" is not a frontend file`;
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
