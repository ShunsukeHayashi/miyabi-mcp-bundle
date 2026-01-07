import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/Users/shunsukehayashi/dev/miyabi-mcp-bundle/dist/index.js'],
  env: {
    MIYABI_REPO_PATH: '/Users/shunsukehayashi/dev/miyabi-mcp-bundle'
  }
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Test: git_status tool
console.log('🔍 Testing git_status tool...\n');
const result = await client.callTool({
  name: 'git_status',
  arguments: {}
});

console.log('Git Status Result:');
console.log(JSON.parse(result.content[0].text));

await client.close();
process.exit(0);
