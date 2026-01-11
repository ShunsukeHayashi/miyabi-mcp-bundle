
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

import { sanitizeShellArg, commandExists } from '../utils/security.js';

const execAsync = promisify(exec);

export const tmuxTools: Tool[] = [
    { name: 'tmux_list_sessions', description: 'List all tmux sessions with window count and status. Discover active terminal sessions.', inputSchema: { type: 'object', properties: {} } },
    { name: 'tmux_list_windows', description: 'List windows in a tmux session. Shows window index, name, and active status.', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name (optional, lists all if omitted)' } } } },
    { name: 'tmux_list_panes', description: 'List panes in tmux windows with their dimensions and commands.', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name (optional)' } } } },
    { name: 'tmux_send_keys', description: 'Send keystrokes or text to a tmux pane. Use for automation or remote commands.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (e.g., session:window.pane or %id)' }, keys: { type: 'string', description: 'Keys/text to send' } }, required: ['target', 'keys'] } },
    { name: 'tmux_pane_capture', description: 'Capture terminal output from a pane. Get scrollback history for debugging.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (e.g., session:window.pane or %id)' }, lines: { type: 'number', description: 'Number of lines to capture (default: all)' } } } },
    { name: 'tmux_pane_search', description: 'Search pane content for a pattern. Find specific output in terminal history.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane (optional)' }, pattern: { type: 'string', description: 'Search pattern (substring match)' } }, required: ['pattern'] } },
    { name: 'tmux_pane_tail', description: 'Get last N lines from pane output. Monitor recent command results.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' }, lines: { type: 'number', description: 'Number of lines to retrieve' } } } },
    { name: 'tmux_pane_is_busy', description: 'Check if a pane is running a command. Useful for waiting on long operations.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' } } } },
    { name: 'tmux_pane_current_command', description: 'Get the command currently running in a pane. Identify active processes.', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Target pane' } } } },
    { name: 'tmux_session_info', description: 'Get detailed tmux session info including creation time and attached clients.', inputSchema: { type: 'object', properties: { session: { type: 'string', description: 'Session name' } }, required: ['session'] } },
];

export async function handleTmuxTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const hasTmux = await commandExists('tmux', execAsync);
    if (!hasTmux) {
        return { error: 'tmux is not installed' };
    }

    const target = sanitizeShellArg((args.target as string) || '');
    const session = sanitizeShellArg((args.session as string) || '');

    if (name === 'tmux_list_sessions') {
        try {
            const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}:#{session_created}"');
            return { sessions: stdout.trim().split('\n').filter(Boolean) };
        } catch {
            return { sessions: [], message: 'No tmux sessions' };
        }
    }
    if (name === 'tmux_list_windows') {
        const cmd = session ? `tmux list-windows -t "${session}" -F "#{window_index}:#{window_name}:#{window_active}"` : 'tmux list-windows -F "#{window_index}:#{window_name}:#{window_active}"';
        try {
            const { stdout } = await execAsync(cmd);
            return { windows: stdout.trim().split('\n').filter(Boolean) };
        } catch {
            return { windows: [], message: 'Session not found or no windows' };
        }
    }
    if (name === 'tmux_list_panes') {
        const cmd = session
            ? `tmux list-panes -t "${session}" -F "#{pane_id}:#{pane_current_command}:#{pane_pid}:#{pane_active}"`
            : 'tmux list-panes -a -F "#{session_name}:#{pane_id}:#{pane_current_command}:#{pane_active}"';
        try {
            const { stdout } = await execAsync(cmd);
            return { panes: stdout.trim().split('\n').filter(Boolean) };
        } catch {
            return { panes: [], message: 'Session not found or no panes' };
        }
    }
    if (name === 'tmux_send_keys') {
        const keys = sanitizeShellArg(args.keys as string);
        if (!target) return { error: 'Target pane required' };
        try {
            await execAsync(`tmux send-keys -t "${target}" "${keys}" Enter`);
            return { success: true };
        } catch {
            return { error: 'Failed to send keys. Target pane might not exist.' };
        }
    }
    if (name === 'tmux_pane_capture') {
        const lines = Math.min(Math.max((args.lines as number) || 100, 1), 10000);
        try {
            const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p -S -${lines}`);
            return { content: stdout };
        } catch {
            return { error: 'Failed to capture pane. Target pane might not exist.' };
        }
    }
    if (name === 'tmux_pane_search') {
        const pattern = sanitizeShellArg(args.pattern as string);
        try {
            const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p | grep -i "${pattern}" || true`);
            return { matches: stdout.trim().split('\n').filter(Boolean) };
        } catch {
            return { error: 'Search failed or target pane not found.' };
        }
    }
    if (name === 'tmux_pane_tail') {
        const lines = Math.min(Math.max((args.lines as number) || 20, 1), 1000);
        try {
            const { stdout } = await execAsync(`tmux capture-pane -t "${target}" -p | tail -n ${lines}`);
            return { content: stdout };
        } catch {
            return { error: 'Tail failed. Target pane might not exist.' };
        }
    }
    if (name === 'tmux_pane_is_busy') {
        try {
            const { stdout } = await execAsync(`tmux display-message -t "${target}" -p "#{pane_current_command}"`);
            const cmd = stdout.trim();
            return { busy: !['bash', 'zsh', 'fish', 'sh', 'dash'].includes(cmd), command: cmd };
        } catch {
            return { error: 'Target pane not found' };
        }
    }
    if (name === 'tmux_pane_current_command') {
        try {
            const { stdout } = await execAsync(`tmux display-message -t "${target}" -p "#{pane_current_command}"`);
            return { command: stdout.trim() };
        } catch {
            return { error: 'Target pane not found' };
        }
    }
    if (name === 'tmux_session_info') {
        if (!session) return { error: 'Session name required' };
        try {
            const { stdout } = await execAsync(`tmux display-message -t "${session}" -p "name:#{session_name},windows:#{session_windows},attached:#{session_attached},created:#{session_created}"`);
            return { info: stdout.trim() };
        } catch {
            return { error: 'Session not found' };
        }
    }
    throw new Error(`Unknown tool: ${name}`);
}
