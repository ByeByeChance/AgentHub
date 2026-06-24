export interface BashValidationResult {
  allowed: boolean;
  blockedReason?: string;
}

export interface PathValidationResult {
  allowed: boolean;
  resolvedPath?: string;
  blockedReason?: string;
}

// POSIX blacklist patterns — each entry is a regex that, if matched, blocks the command
const POSIX_BLACKLIST: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[rRf]+\s+)*\//, reason: 'rm -rf on root path blocked' },
  { pattern: /\brm\s+(-[rRf]+\s+)/, reason: 'rm with force/recursive flags blocked' },
  { pattern: /\bsudo\b/, reason: 'sudo is blocked' },
  { pattern: /\bchmod\s+.*777/, reason: 'chmod 777 is blocked' },
  { pattern: /\bcurl\b.*\|.*\b(bash|sh|zsh)\b/, reason: 'curl piped to shell is blocked' },
  { pattern: /\bwget\b.*\|.*\b(bash|sh|zsh)\b/, reason: 'wget piped to shell is blocked' },
  { pattern: /\/dev\/sd[a-z]/, reason: 'direct /dev/sd* access is blocked' },
  { pattern: /:\(\)\s*\{/, reason: 'fork bomb pattern blocked' },
  { pattern: /\bmkfs\b/, reason: 'mkfs is blocked' },
  { pattern: /\bdd\s+if=/, reason: 'dd is blocked' },
  { pattern: /\breboot\b/, reason: 'reboot is blocked' },
  { pattern: /\bshutdown\b/, reason: 'shutdown is blocked' },
  { pattern: /\bkill\s+-9/, reason: 'kill -9 is blocked' },
  { pattern: /\bchown\b/, reason: 'chown is blocked' },
  { pattern: /\beval\b/, reason: 'eval is blocked' },
  { pattern: /\bexec\b/, reason: 'exec is blocked' },
  { pattern: /\bnc\b/, reason: 'netcat is blocked' },
  { pattern: /\btelnet\b/, reason: 'telnet is blocked' },
  { pattern: /\bpasswd\b/, reason: 'passwd is blocked' },
  { pattern: /\bdocker\s+rm\b/, reason: 'docker rm is blocked' },
  { pattern: /\bgit\s+push\s+--force\b/, reason: 'git push --force is blocked' },
  { pattern: /\bnpm\s+publish\b/, reason: 'npm publish is blocked' },
  { pattern: /\bsource\s+\/dev\//, reason: 'source from /dev/ is blocked' },
];

// Windows blacklist patterns
const WINDOWS_BLACKLIST: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bformat\s+[A-Z]:/i, reason: 'format is blocked' },
  { pattern: /\bdiskpart\b/i, reason: 'diskpart is blocked' },
  { pattern: /\breg\s+delete\b/i, reason: 'reg delete is blocked' },
  { pattern: /\bshutdown\s+\/s\b/i, reason: 'shutdown /s is blocked' },
  { pattern: /\bdel\s+\/f\s+\/s\b/i, reason: 'del /f /s is blocked' },
];

export function validateBashCommand(
  command: string,
  platform: 'posix' | 'windows' = 'posix',
): BashValidationResult {
  if (!command || command.trim().length === 0) {
    return { allowed: false, blockedReason: 'empty command' };
  }

  const blacklist = platform === 'posix' ? POSIX_BLACKLIST : WINDOWS_BLACKLIST;

  for (const entry of blacklist) {
    if (entry.pattern.test(command)) {
      return { allowed: false, blockedReason: entry.reason };
    }
  }

  return { allowed: true };
}

export function validatePath(
  requestedPath: string,
  workspaceRoot: string,
): PathValidationResult {
  // Reject empty paths
  if (!requestedPath || requestedPath.trim().length === 0) {
    return { allowed: false, blockedReason: 'empty path' };
  }

  // Reject null bytes
  if (requestedPath.includes('\x00')) {
    return { allowed: false, blockedReason: 'null byte in path' };
  }

  // Reject URL-encoded traversal attempts
  if (requestedPath.includes('%2e%2e') || requestedPath.includes('%2E%2E')) {
    return { allowed: false, blockedReason: 'URL-encoded traversal detected' };
  }

  // Reject path traversal patterns
  const segments = requestedPath.replace(/\\/g, '/').split('/');

  for (const segment of segments) {
    if (segment === '..') {
      return { allowed: false, blockedReason: 'path traversal (..) blocked' };
    }
  }

  // Normalize workspace root
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');

  let resolved: string;
  if (requestedPath.startsWith('/')) {
    // Absolute path — must be within workspace
    resolved = requestedPath.replace(/\\/g, '/');
  } else {
    // Relative path — resolve against workspace root
    resolved = `${normalizedRoot}/${requestedPath}`.replace(/\/+/g, '/');
  }

  // Remove trailing slash for comparison
  resolved = resolved.replace(/\/$/, '');

  // Ensure resolved path is within workspace
  if (!resolved.startsWith(normalizedRoot)) {
    return { allowed: false, blockedReason: 'path escapes workspace root' };
  }

  return { allowed: true, resolvedPath: resolved };
}
