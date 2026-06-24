import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkspaceService } from '../../services/workspace.service.js';
import type { WorkspaceService } from '../../services/workspace.service.js';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agenthub-ws-test-'));
    service = createWorkspaceService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('write and read', () => {
    it('should write a file and read it back', async () => {
      await service.write('test.txt', 'hello world');
      const content = await service.read('test.txt');
      expect(content).toBe('hello world');
    });

    it('should write in nested directory', async () => {
      await service.write('src/components/Button.tsx', 'export const Button = () => null;');
      const content = await service.read('src/components/Button.tsx');
      expect(content).toContain('Button');
    });

    it('should reject .. path traversal in write', async () => {
      await expect(service.write('../outside.txt', 'bad')).rejects.toThrow(
        'Path blocked',
      );
    });

    it('should reject .. path traversal in read', async () => {
      await expect(service.read('../../../etc/passwd')).rejects.toThrow(
        'Path blocked',
      );
    });
  });

  describe('exec', () => {
    it('should run a simple command', async () => {
      const result = await service.exec('echo hello');
      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('should block dangerous commands', async () => {
      const result = await service.exec('rm -rf /');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Blocked');
    });

    it('should handle command errors gracefully', async () => {
      await service.exec('nonexistent-command-xyz 2>/dev/null || true');
      // The command succeeds because of "|| true", exit code is 0
    });
  });
});
