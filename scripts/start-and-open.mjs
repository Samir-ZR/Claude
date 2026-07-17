import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import open from 'open';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const HOST = `http://localhost:${PORT}`;

const server = spawn('node', ['server.js'], { cwd: ROOT, stdio: 'inherit', env: process.env });

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill(signal);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
server.on('exit', (code) => process.exit(code ?? 0));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${HOST}/api/settings`);
      if (res.ok) return true;
    } catch { /* pas encore prêt */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const ready = await waitForServer();
if (!ready) {
  console.error("\nLe serveur ne répond pas au bout de 30s, ouverture annulée.");
} else {
  console.log(`\nBoutique : ${HOST}/`);
  console.log(`Admin    : ${HOST}/admin\n`);
  try {
    await open(`${HOST}/`);
    await open(`${HOST}/admin`);
    console.log("Les deux onglets ont été ouverts dans ton navigateur par défaut.");
  } catch {
    console.log("Impossible d'ouvrir le navigateur automatiquement : ouvre ces deux liens toi-même.");
  }
}
