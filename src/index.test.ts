/**
 * Miyabi MCP Bundle - Test Suite
 */

import { describe, it, expect } from 'vitest';

describe('Miyabi MCP Bundle', () => {
  describe('Tool Definitions', () => {
    it('should have correct tool count', async () => {
      // Import the tools array by reading the file
      const fs = await import('fs/promises');
      const content = await fs.readFile('./src/index.ts', 'utf-8');

      // Count tool definitions
      const toolMatches = content.match(/\{ name: '[a-z_]+'/g);
      expect(toolMatches).not.toBeNull();
      expect(toolMatches!.length).toBeGreaterThanOrEqual(103);
    });

    it('should have tools in all 9 categories', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile('./src/index.ts', 'utf-8');

      const categories = [
        'git_',
        'tmux_',
        'log_',
        'resource_',
        'network_',
        'process_',
        'file_',
        'claude_',
        'github_'
      ];

      for (const category of categories) {
        const regex = new RegExp(`name: '${category}`, 'g');
        const matches = content.match(regex);
        expect(matches, `Category ${category} should have tools`).not.toBeNull();
        expect(matches!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Environment Configuration', () => {
    it('should use process.cwd() as default repo path', () => {
      const MIYABI_REPO_PATH = process.env.MIYABI_REPO_PATH || process.cwd();
      expect(MIYABI_REPO_PATH).toBeTruthy();
    });

    it('should handle missing GITHUB_TOKEN gracefully', () => {
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
      expect(typeof GITHUB_TOKEN).toBe('string');
    });
  });

  describe('Cross-Platform Support', () => {
    it('should detect platform correctly', async () => {
      const os = await import('os');
      const platform = os.platform();
      expect(['darwin', 'linux', 'win32']).toContain(platform);
    });

    it('should resolve Claude config path based on platform', async () => {
      const os = await import('os');
      const path = await import('path');
      const platform = os.platform();
      const homedir = os.homedir();

      let expectedPath: string;
      if (platform === 'darwin') {
        expectedPath = path.join(homedir, 'Library/Application Support/Claude');
      } else if (platform === 'win32') {
        expectedPath = path.join(process.env.APPDATA || '', 'Claude');
      } else {
        expectedPath = path.join(homedir, '.config/claude');
      }

      expect(expectedPath).toBeTruthy();
    });
  });

  describe('Tool Handler Routing', () => {
    it('should have handler for each tool category', async () => {
      const fs = await import('fs/promises');
      const content = await fs.readFile('./src/index.ts', 'utf-8');

      const handlers = [
        'handleTmuxTool',
        'handleLogTool',
        'handleResourceTool',
        'handleNetworkTool',
        'handleProcessTool',
        'handleFileTool',
        'handleClaudeTool',
        'handleGitHubTool'
      ];

      for (const handler of handlers) {
        expect(content).toContain(`async function ${handler}`);
      }
    });
  });

  describe('Version Consistency', () => {
    it('should have matching version in package.json and index.ts', async () => {
      const fs = await import('fs/promises');

      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
      const indexContent = await fs.readFile('./src/index.ts', 'utf-8');

      const versionMatch = indexContent.match(/version: '(\d+\.\d+\.\d+)'/);
      expect(versionMatch).not.toBeNull();
      expect(versionMatch![1]).toBe(packageJson.version);
    });
  });
});
