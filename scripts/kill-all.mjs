/**
 * Stops all development environment processes:
 * host-app (:5280), HTTP add-on (:5294), and in-process add-ons
 * (:5304, :5306-5308), including leftover dev-all orphans (Vite / add-on servers).
 * Usage: pnpm kill-all
 * Sends SIGTERM and, if a process persists, SIGKILL.
 *
 * The ports and patterns below must follow `ADDON_SERVERS` in
 * `scripts/dev-all.mjs` when an executable project is added, removed, or changes port.
 *
 * Tools used in order: fuser → ss (to find listeners) and pgrep (for dev-all
 * orphans). The current process and its ancestors are always excluded so
 * kill-all never kills itself.
 */
import { execFileSync } from 'node:child_process';

const PORTS = [
  5280,
  5294,
  5304, 5306, 5307, 5308,
];

/** PIDs listening on the port. fuser returns PIDs; ss is the fallback. */
function pidsOnPort(port) {
  // fuser: `fuser 5294/tcp` → "5294/tcp:  44364" (exit 1 when empty)
  try {
    const out = execFileSync('fuser', [port + '/tcp'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = out.split(/\s+/).map((t) => t.trim()).filter((t) => /^\d+$/.test(t)).map(Number);
    if (pids.length > 0) return pids;
  } catch {
    /* fall back to ss */
  }
  // ss: `ss -tlnp` → lines with ":5294" and users:(("node",pid=44364,fd=21))
  try {
    const out = execFileSync('ss', ['-tlnp'], { encoding: 'utf8' });
    const line = out.split('\n').find((l) => l.includes(':' + port + ' '));
    if (!line) return [];
    const pids = [];
    for (const m of line.matchAll(/pid=(\d+)/g)) pids.push(Number(m[1]));
    return pids;
  } catch {
    return [];
  }
}

/** PIDs matching the pattern (dev-all orphans that are no longer listening). */
function pidsByPattern(pattern) {
  try {
    const out = execFileSync('pgrep', ['-f', pattern], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((l) => l.trim()).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

/** Ancestor chain of the current process (never kill itself or the user's shell). */
function ancestorChain() {
  const chain = new Set([process.pid]);
  let pid = process.pid;
  while (pid > 1) {
    try {
      const ppid = Number(
        execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' }).trim(),
      );
      if (!ppid || ppid === pid || chain.has(ppid)) break;
      chain.add(ppid);
      pid = ppid;
    } catch {
      break;
    }
  }
  return chain;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const exclude = ancestorChain();
const pids = new Set();

for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) {
    if (!exclude.has(pid)) pids.add(pid);
  }
}

// dev-all orphans: the coordinator process, Vite, in-process servers, and the
// wrappers for the five HTTP servers. Keep these patterns synchronized with
// ADDON_SERVERS in dev-all.mjs.
for (const pattern of [
  'dev-all\\.mjs',
  'serve-inprocess-addon\\.mjs',
  'addon-text-wikipedia',
  'vite/bin/vite\\.js',
]) {
  for (const pid of pidsByPattern(pattern)) {
    if (!exclude.has(pid) && alive(pid)) pids.add(pid);
  }
}

if (pids.size === 0) {
  console.log(`[kill-all] Nothing is running on ports ${PORTS.join('/')}. All clear.`);
  process.exit(0);
}

console.log('[kill-all] Stopping processes: ' + [...pids].join(', '));
for (const pid of pids) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* already exited */
  }
}

await new Promise((r) => setTimeout(r, 1500));

const survivors = [...pids].filter(alive);
for (const pid of survivors) {
  console.log('[kill-all] SIGKILL on process ' + pid);
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* already exited */
  }
}

await new Promise((r) => setTimeout(r, 500));

const remaining = [...pids].filter(alive);
if (remaining.length === 0) {
  console.log('[kill-all] Done. All development processes have stopped.');
} else {
  console.error('[kill-all] Still running: ' + remaining.join(', '));
  process.exit(1);
}
