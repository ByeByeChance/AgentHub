import { validatePath, validateBashCommand } from '@agenthub/shared/security';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkspaceService } from './interfaces/workspace.interface.js';
export type { WorkspaceService };

const execAsync = promisify(exec);

export class RealWorkspaceService implements WorkspaceService {
  constructor(private readonly workspaceRoot: string) {}

  async read(relativePath: string): Promise<string> {
    try {
      const pathResult = validatePath(relativePath, this.workspaceRoot);
      if (!pathResult.allowed) {
        throw new Error(`Path blocked: ${pathResult.blockedReason}`);
      }
      return readFile(pathResult.resolvedPath!, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read workspace file '${relativePath}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async write(relativePath: string, content: string): Promise<void> {
    try {
      const pathResult = validatePath(relativePath, this.workspaceRoot);
      if (!pathResult.allowed) {
        throw new Error(`Path blocked: ${pathResult.blockedReason}`);
      }
      // Ensure parent directories exist
      const dir = join(pathResult.resolvedPath!, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(pathResult.resolvedPath!, content, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to write workspace file '${relativePath}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async exec(
    command: string,
    platform: 'posix' | 'windows' = 'posix',
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const bashResult = validateBashCommand(command, platform);
    if (!bashResult.allowed) {
      return {
        stdout: '',
        stderr: `Blocked: ${bashResult.blockedReason}`,
        exitCode: 1,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        timeout: SERVICE_DEFAULTS.workspace.timeout,
        maxBuffer: SERVICE_DEFAULTS.workspace.maxBuffer,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? String(err),
        exitCode: error.code ?? 1,
      };
    }
  }
}

export function createWorkspaceService(
  workspaceRoot: string,
): WorkspaceService {
  return new RealWorkspaceService(workspaceRoot);
}
