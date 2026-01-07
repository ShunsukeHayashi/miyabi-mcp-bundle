import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/Users/shunsukehayashi/dev/miyabi-mcp-bundle/dist/index.js'],
  env: {
    MIYABI_REPO_PATH: '/Users/shunsukehayashi/dev',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN
  }
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

console.log('🧪 Testing mcp_list_categories tool...\n');

const result = await client.callTool({
  name: 'mcp_list_categories',
  arguments: {}
});

const data = JSON.parse(result.content[0].text);

console.log('📊 Tool Categories Summary:');
console.log('='.repeat(60));
console.log(`Total Tools: ${data.totalTools}`);
console.log(`Categories: ${data.categoryCount}`);
console.log('='.repeat(60));
console.log();

console.log('📋 Categories Breakdown:\n');
data.categories.forEach((cat, index) => {
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${cat.category.padEnd(12)} - ${cat.count.toString().padStart(3)} tools | ${cat.description}`);
});

await client.close();
process.exit(0);
