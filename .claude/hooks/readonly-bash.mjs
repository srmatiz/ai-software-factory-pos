#!/usr/bin/env node
// PreToolUse hook for read-only agents (e.g. codebase-researcher).
// Allows only inspection commands; exit code 2 blocks the call and the
// stderr message is shown to the agent.

const ALLOWED = new Set(["grep", "rg", "find", "ls", "cat", "head", "tail", "wc", "sed", "git", "pwd"]);
const GIT_READ = new Set(["log", "show", "diff", "status", "grep", "ls-files", "blame", "branch"]);
const FIND_WRITE = /^-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/;

const input = JSON.parse(await readStdin());
const command = input?.tool_input?.command ?? "";

const error = check(command);
if (error) {
  process.stderr.write(`Blocked (read-only agent): ${error}. Allowed: ${[...ALLOWED].join(", ")}.\n`);
  process.exit(2);
}
process.exit(0);

function check(cmd) {
  const segments = splitSegments(cmd);
  if (typeof segments === "string") return segments;
  for (const words of segments) {
    if (words.length === 0) return "empty command segment";
    const [name, ...args] = words;
    if (!ALLOWED.has(name)) return `"${name}" is not an inspection command`;
    if (args.some((a) => /^--(output|pre)\b/.test(a))) return "--output and --pre are blocked";
    if (name === "sed") {
      const [flag, script, ...files] = args;
      if (flag !== "-n" || !/^\d+(,(\d+|\$))?p$/.test(script ?? "") || files.some((f) => f.startsWith("-")))
        return "sed is only allowed as `sed -n <start>,<end>p <file>`";
    }
    if (name === "find" && args.some((a) => FIND_WRITE.test(a)))
      return "find actions that execute or write are blocked";
    if (name === "git") {
      // Global options (-c, --config-env, --exec-path, ...) can run arbitrary programs.
      const [sub, ...subArgs] = args;
      if (sub?.startsWith("-")) return "git global options are blocked; put the subcommand first";
      if (!GIT_READ.has(sub)) return `git ${sub ?? ""} is not a read-only subcommand`;
      if (sub === "grep" && subArgs.some((a) => /^(-[A-Za-z0-9]*O|--open-files-in-pager)/.test(a)))
        return "git grep --open-files-in-pager is blocked";
      if (sub === "branch" && subArgs.some((a) => !/^(-a|-r|-v|-vv|--list|--all|--show-current)$/.test(a)))
        return "git branch may only list";
      if (subArgs.includes("--ext-diff")) return "--ext-diff is blocked";
    }
  }
  return null;
}

// Splits on |, && and || outside quotes. Rejects redirection, background,
// command separators and command substitution. "2>/dev/null" is allowed.
function splitSegments(cmd) {
  const segments = [[]];
  let word = "";
  let quote = null;
  const pushWord = () => {
    if (word !== "") segments.at(-1).push(word);
    word = "";
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (c === "`" || (c === "$" && cmd[i + 1] === "(")) return "command substitution is blocked";
    if (quote === '"') {
      if (c === '"') quote = null;
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (cmd.startsWith("2>/dev/null", i)) {
      pushWord();
      i += "2>/dev/null".length - 1;
      continue;
    }
    if (c === ">" || c === "<") return "redirection is blocked";
    if (c === ";" || c === "\n") return "command separators are blocked; use | or &&";
    if (c === "|" || c === "&") {
      const op = cmd.slice(i, i + 2);
      if (op === "&&" || op === "||") i++;
      else if (c === "&") return "background execution is blocked";
      pushWord();
      segments.push([]);
      continue;
    }
    if (c === " " || c === "\t") {
      pushWord();
      continue;
    }
    word += c;
  }
  if (quote) return "unbalanced quotes";
  pushWord();
  return segments;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
