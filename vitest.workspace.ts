import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'services/*',
  'frontend',
  '!services/mcp-gateway',
]);
