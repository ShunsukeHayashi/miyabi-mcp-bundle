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

console.log('🔍 Exploring GitHub Tools in miyabi-mcp-bundle...\n');

// Search for GitHub category tools
const result = await client.callTool({
  name: 'mcp_search_tools',
  arguments: {
    category: 'github'
  }
});

const data = JSON.parse(result.content[0].text);

console.log('📊 GitHub Tools Summary');
console.log('='.repeat(80));
console.log(`Found: ${data.tools.length} GitHub tools`);
console.log('='.repeat(80));
console.log();

// Group tools by functionality
const groups = {
  'Issues': [],
  'Pull Requests': [],
  'Repository': [],
  'Labels & Milestones': [],
  'Workflows & CI': [],
  'Other': []
};

data.tools.forEach(tool => {
  if (tool.name.includes('issue') && !tool.name.includes('pr')) {
    groups['Issues'].push(tool);
  } else if (tool.name.includes('pr') || tool.name.includes('pull') || tool.name.includes('review')) {
    groups['Pull Requests'].push(tool);
  } else if (tool.name.includes('label') || tool.name.includes('milestone')) {
    groups['Labels & Milestones'].push(tool);
  } else if (tool.name.includes('workflow') || tool.name.includes('check')) {
    groups['Workflows & CI'].push(tool);
  } else if (tool.name.includes('repo') || tool.name.includes('release') || tool.name.includes('branch') || tool.name.includes('compare')) {
    groups['Repository'].push(tool);
  } else {
    groups['Other'].push(tool);
  }
});

// Display grouped tools
for (const [group, tools] of Object.entries(groups)) {
  if (tools.length > 0) {
    console.log(`\n📁 ${group} (${tools.length} tools):`);
    console.log('-'.repeat(80));
    tools.forEach((tool, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${tool.name.padEnd(30)} | ${tool.description}`);
    });
  }
}

console.log('\n');
console.log('💡 Usage Examples:');
console.log('='.repeat(80));
console.log('1. List issues:        github_list_issues({ "state": "open" })');
console.log('2. Create issue:       github_create_issue({ "title": "Bug fix", "body": "..." })');
console.log('3. List PRs:           github_list_prs({ "state": "open" })');
console.log('4. Create PR:          github_create_pr({ "title": "...", "head": "feature", "base": "main" })');
console.log('5. Repo info:          github_repo_info({})');
console.log('6. List workflows:     github_list_workflows({})');
console.log('='.repeat(80));

await client.close();
process.exit(0);
