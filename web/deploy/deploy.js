#!/usr/bin/env node
/**
 * Topragh deploy (standalone domain account only):
 * build → tar.gz → scp → extract → rsync into that domain's public_html
 * Do NOT deploy under hesabdaram Virtualmin paths.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(__dirname, '.deploy.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — copy from .deploy.env.example`);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '));
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const env = loadEnv();

  const host = env.SSH_HOST;
  const port = env.SSH_PORT || '2212';
  const user = env.SSH_USERNAME;
  const remotePath = env.REMOTE_PUBLIC_HTML_PATH;
  const key = env.SSH_PRIVATE_KEY_PATH;
  if (!host || !user || !remotePath) {
    throw new Error('SSH_HOST, SSH_USERNAME, REMOTE_PUBLIC_HTML_PATH required');
  }

  if (!skipBuild) {
    run('npm', ['run', 'build'], { cwd: webRoot });
  }

  const dist = path.join(webRoot, 'dist');
  if (!fs.existsSync(dist)) throw new Error('dist/ missing — run build first');

  const stamp = Date.now();
  const tarName = `topragh-${stamp}.tar.gz`;
  const localTar = path.join(os.tmpdir(), tarName);
  run('tar', ['-czf', localTar, '-C', dist, '.']);

  const sshBase = ['-p', port, '-o', 'StrictHostKeyChecking=yes'];
  if (key) sshBase.push('-i', key);
  const scpBase = ['-P', port, '-o', 'StrictHostKeyChecking=yes'];
  if (key) scpBase.push('-i', key);

  const remoteTar = `/tmp/${tarName}`;
  const remoteStage = `/tmp/topragh-${stamp}`;
  run('scp', [...scpBase, localTar, `${user}@${host}:${remoteTar}`]);

  const remoteCmd = [
    `mkdir -p "${remoteStage}" "${remotePath}"`,
    `tar -xzf "${remoteTar}" -C "${remoteStage}"`,
    `rsync -a --delete "${remoteStage}/" "${remotePath}/"`,
    `rm -rf "${remoteStage}" "${remoteTar}"`,
  ].join(' && ');

  run('ssh', [...sshBase, `${user}@${host}`, remoteCmd]);
  fs.rmSync(localTar, { force: true });

  const url = env.SITE_URL || 'https://topragh.ir';
  console.log(`Deployed to ${remotePath}. Smoke: ${url}`);
}

main();
