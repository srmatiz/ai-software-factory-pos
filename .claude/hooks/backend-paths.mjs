#!/usr/bin/env node
// PreToolUse hook for the backend-builder agent.
// Allows Edit/Write only on backend files; exit code 2 blocks the call and
// the stderr message is shown to the agent.

import { existsSync } from "node:fs";
import path from "node:path";

// Repo-relative path patterns the backend builder may write.
const ALLOWED = [
  /^prisma\/schema\.prisma$/,
  /^src\/server\/.+\.ts$/,
  /^src\/lib\/.+\.ts$/,
  /^src\/app\/.+\/actions\.ts$/,
  /^src\/app\/api\/.+\/route\.ts$/,
  /^src\/env\.ts$/,
  /^\.env\.example$/,
  /^tests\/(unit|integration)\/.+\.ts$/,
];

// Allowed by the patterns above but still off limits.
const BLOCKED = [
  [/^src\/lib\/utils\.ts$/, "src/lib/utils.ts is a UI helper"],
  [/^src\/lib\/barcode-scanner\.ts$/, "the scanner detector belongs to the frontend"],
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
    `Blocked (backend-builder): ${error}. Allowed: prisma/schema.prisma, src/server/**, src/lib/** (.ts), ` +
      `src/app/**/actions.ts, src/app/api/**/route.ts, src/env.ts, .env.example, tests/unit/**, tests/integration/**.\n`,
  );
  process.exit(2);
}
process.exit(0);

function check(p) {
  if (!p || p.startsWith("..")) return `"${filePath}" is outside the repository`;
  if (p.startsWith("prisma/migrations/"))
    return "migrations are generated with `npm run db:migrate -- --name <change>`, never written or edited by hand";
  for (const [re, why] of BLOCKED) if (re.test(p)) return why;
  if (!ALLOWED.some((re) => re.test(p))) return `"${p}" is not a backend file`;
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
