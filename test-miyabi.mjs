import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/Users/shunsukehayashi/dev/miyabi-mcp-bundle/dist/index.js']
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Test: List all tools
console.log('🔍 Testing miyabi-mcp-bundle...\n');
const tools = await client.listTools();
console.log(`✅ Found ${tools.tools.length} tools\n`);
console.log('First 10 tools:');
tools.tools.slice(0, 10).forEach((tool, i) => {
  console.log(`${i + 1}. ${tool.name} - ${tool.description}`);
});

// Test: Call mcp_list_categories
console.log('\n🏷️  Testing mcp_list_categories tool...\n');
const result = await client.callTool({
  name: 'mcp_list_categories',
  arguments: {}
});

console.log('Result:', JSON.stringify(result, null, 2));

await client.close();
process.exit(0);
