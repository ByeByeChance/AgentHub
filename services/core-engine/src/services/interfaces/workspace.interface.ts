export interface WorkspaceService {
  read(relativePath: string): Promise<string>;
  write(relativePath: string, content: string): Promise<void>;
  exec(
    command: string,
    platform?: 'posix' | 'windows',
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}
