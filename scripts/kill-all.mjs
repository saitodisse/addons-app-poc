/**
 * Mata todos os processos do ambiente de desenvolvimento:
 * host-app (:5280), add-ons HTTP (:5291-5294) e add-ons em processo
 * (:5301-5310), incluindo órfãos do dev-all (vite / add-on servers) que
 * tenham sobrado.
 * Uso: pnpm kill-all
 * Envia SIGTERM e, se o processo insistir, SIGKILL.
 *
 * A lista de portas e os padrões abaixo precisam acompanhar
 * `ADDON_SERVERS` em `scripts/dev-all.mjs` quando um projeto executável for
 * adicionado, removido ou mudar de porta.
 *
 * Ferramentas usadas na ordem: fuser → ss (para descobrir quem escuta na
 * porta) e pgrep (para órfãos do dev-all). O próprio processo e seus
 * ancestrais são sempre excluídos, para o kill-all nunca se auto-matar.
 */
import { execFileSync } from 'node:child_process';

const PORTS = [
  5280,
  5291, 5292, 5293, 5294,
  5301, 5302, 5303, 5304, 5305, 5306, 5307, 5308, 5309, 5310,
];

/** PIDs escutando na porta. fuser devolve os PIDs; ss é o fallback. */
function pidsOnPort(port) {
  // fuser: `fuser 5291/tcp` → "5291/tcp:  44364" (exit 1 quando não há nada)
  try {
    const out = execFileSync('fuser', [port + '/tcp'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = out.split(/\s+/).map((t) => t.trim()).filter((t) => /^\d+$/.test(t)).map(Number);
    if (pids.length > 0) return pids;
  } catch {
    /* cai para o ss */
  }
  // ss: `ss -tlnp` → linhas com ":5291" e users:(("node",pid=44364,fd=21))
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

/** PIDs casando com o padrão (órfãos do dev-all que não estejam mais escutando). */
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

/** Cadeia de ancestrais do processo atual (nunca matar a si mesmo nem o shell do usuário). */
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

// Órfãos do dev-all: o processo coordenador, o Vite, os servidores em
// processo e os wrappers dos quatro servidores HTTP. Mantenha estes padrões
// sincronizados com ADDON_SERVERS em dev-all.mjs.
for (const pattern of [
  'dev-all\\.mjs',
  'serve-inprocess-addon\\.mjs',
  'addon-text-(biblioteca|citacoes|poemas|wikipedia)',
  'vite/bin/vite\\.js',
]) {
  for (const pid of pidsByPattern(pattern)) {
    if (!exclude.has(pid) && alive(pid)) pids.add(pid);
  }
}

if (pids.size === 0) {
  console.log(`[kill-all] Nada rodando nas portas ${PORTS.join('/')}. Tudo limpo.`);
  process.exit(0);
}

console.log('[kill-all] Encerrando processos: ' + [...pids].join(', '));
for (const pid of pids) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* já morreu */
  }
}

await new Promise((r) => setTimeout(r, 1500));

const sobreviventes = [...pids].filter(alive);
for (const pid of sobreviventes) {
  console.log('[kill-all] SIGKILL no processo ' + pid);
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* já morreu */
  }
}

await new Promise((r) => setTimeout(r, 500));

const restantes = [...pids].filter(alive);
if (restantes.length === 0) {
  console.log('[kill-all] Pronto. Todos os processos do dev foram encerrados.');
} else {
  console.error('[kill-all] Ainda vivos: ' + restantes.join(', '));
  process.exit(1);
}
