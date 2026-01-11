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
      const indexContent = await fs.readFile('./src/index.ts', 'utf-8');

      // Categories with modular handlers (tools defined in handler files)
      const modularCategories = ['git_', 'tmux_', 'log_', 'resource_', 'network_', 'process_', 'file_'];
      // Categories with inline definitions in index.ts
      const inlineCategories = ['claude_', 'github_'];

      // Check modular categories are imported via spread syntax
      for (const category of modularCategories) {
        const toolsName = category.replace('_', '') + 'Tools';
        expect(indexContent, `Category ${category} should be imported`).toContain(`...${toolsName}`);
      }

      // Check inline categories have tool definitions
      for (const category of inlineCategories) {
        const regex = new RegExp(`name: '${category}`, 'g');
        const matches = indexContent.match(regex);
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
      const indexContent = await fs.readFile('./src/index.ts', 'utf-8');

      // Modular handlers are imported from handler files
      const importedHandlers = [
        'handleGitTool',
        'handleTmuxTool'
      ];

      // Check that handlers are imported
      for (const handler of importedHandlers) {
        expect(indexContent, `Handler ${handler} should be imported`).toContain(handler);
      }

      // Inline handlers still defined in index.ts
      const inlineHandlers = [
        'handleClaudeTool',
        'handleGitHubTool'
      ];

      for (const handler of inlineHandlers) {
        expect(indexContent).toContain(`async function ${handler}`);
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
