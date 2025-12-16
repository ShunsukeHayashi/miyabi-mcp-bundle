/**
 * Society Bridge API - Inter-Society Communication
 * Issue #18: Society間通信基盤
 */

interface BridgeMessage {
  id: string;
  from_society: string;
  to_society: string;
  type: 'DATA_SHARE' | 'REQUEST' | 'RESPONSE' | 'NOTIFICATION';
  payload: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ttl: number;
  created_at: string;
  status: 'pending' | 'delivered' | 'acknowledged' | 'expired';
}

interface SharedContext {
  id: string;
  owner_society: string;
  shared_with: string[];
  context_type: string;
  data: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
}

// In-memory storage (production would use Redis/DB)
const messageQueue: BridgeMessage[] = [];
const messageHistory: BridgeMessage[] = [];
const sharedContexts: Map<string, SharedContext> = new Map();

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// === Handler Functions ===

export async function handleBridgeSend(params: {
  from_society: string;
  to_society: string;
  type?: string;
  payload: Record<string, unknown>;
  priority?: string;
  ttl?: number;
}): Promise<object> {
  const message: BridgeMessage = {
    id: generateId(),
    from_society: params.from_society,
    to_society: params.to_society,
    type: (params.type as BridgeMessage['type']) || 'DATA_SHARE',
    payload: params.payload,
    priority: (params.priority as BridgeMessage['priority']) || 'normal',
    ttl: params.ttl || 3600,
    created_at: new Date().toISOString(),
    status: 'pending'
  };

  messageQueue.push(message);
  
  return {
    success: true,
    message_id: message.id,
    status: 'queued',
    queue_position: messageQueue.length,
    estimated_delivery: 'immediate'
  };
}

export async function handleBridgeReceive(params: {
  society: string;
  limit?: number;
  acknowledge?: boolean;
}): Promise<object> {
  const limit = params.limit || 10;
  const pending = messageQueue.filter(m => 
    m.to_society === params.society && m.status === 'pending'
  ).slice(0, limit);

  if (params.acknowledge && pending.length > 0) {
    pending.forEach(m => {
      m.status = 'acknowledged';
      messageHistory.push(m);
    });
    // Remove acknowledged from queue
    pending.forEach(m => {
      const idx = messageQueue.findIndex(q => q.id === m.id);
      if (idx !== -1) messageQueue.splice(idx, 1);
    });
  }

  return {
    society: params.society,
    messages: pending,
    count: pending.length,
    acknowledged: params.acknowledge || false
  };
}

export async function handleBridgeContextShare(params: {
  owner_society: string;
  share_with: string[];
  context_type: string;
  data: Record<string, unknown>;
  ttl?: number;
}): Promise<object> {
  const context: SharedContext = {
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    owner_society: params.owner_society,
    shared_with: params.share_with,
    context_type: params.context_type,
    data: params.data,
    created_at: new Date().toISOString(),
    expires_at: params.ttl 
      ? new Date(Date.now() + params.ttl * 1000).toISOString()
      : undefined
  };

  sharedContexts.set(context.id, context);

  return {
    success: true,
    context_id: context.id,
    shared_with: params.share_with,
    expires_at: context.expires_at
  };
}

export async function handleBridgeContextGet(params: {
  context_id?: string;
  society: string;
  context_type?: string;
}): Promise<object> {
  const now = new Date().toISOString();
  
  // Clean expired contexts
  for (const [id, ctx] of sharedContexts.entries()) {
    if (ctx.expires_at && ctx.expires_at < now) {
      sharedContexts.delete(id);
    }
  }

  if (params.context_id) {
    const ctx = sharedContexts.get(params.context_id);
    if (!ctx) {
      return { error: 'Context not found', context_id: params.context_id };
    }
    if (!ctx.shared_with.includes(params.society) && ctx.owner_society !== params.society) {
      return { error: 'Access denied', context_id: params.context_id };
    }
    return { context: ctx };
  }

  // Find all contexts accessible to this society
  const accessible = Array.from(sharedContexts.values()).filter(ctx =>
    ctx.owner_society === params.society || ctx.shared_with.includes(params.society)
  );

  const filtered = params.context_type
    ? accessible.filter(ctx => ctx.context_type === params.context_type)
    : accessible;

  return {
    society: params.society,
    contexts: filtered,
    count: filtered.length
  };
}

export async function handleBridgeQueueStatus(params?: {
  society?: string;
}): Promise<object> {
  const queue = params?.society
    ? messageQueue.filter(m => m.from_society === params.society || m.to_society === params.society)
    : messageQueue;

  const byPriority = {
    urgent: queue.filter(m => m.priority === 'urgent').length,
    high: queue.filter(m => m.priority === 'high').length,
    normal: queue.filter(m => m.priority === 'normal').length,
    low: queue.filter(m => m.priority === 'low').length
  };

  const byStatus = {
    pending: queue.filter(m => m.status === 'pending').length,
    delivered: queue.filter(m => m.status === 'delivered').length,
    acknowledged: queue.filter(m => m.status === 'acknowledged').length
  };

  return {
    timestamp: new Date().toISOString(),
    filter: params?.society || 'all',
    queue_depth: queue.length,
    by_priority: byPriority,
    by_status: byStatus,
    oldest_message: queue[0]?.created_at || null,
    shared_contexts: sharedContexts.size
  };
}

export async function handleBridgeHistory(params: {
  society?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<object> {
  let history = [...messageHistory];

  if (params.society) {
    history = history.filter(m => 
      m.from_society === params.society || m.to_society === params.society
    );
  }

  if (params.from) {
    history = history.filter(m => m.created_at >= params.from!);
  }

  if (params.to) {
    history = history.filter(m => m.created_at <= params.to!);
  }

  const limit = params.limit || 50;
  history = history.slice(-limit);

  return {
    filter: { society: params.society, from: params.from, to: params.to },
    messages: history,
    count: history.length,
    total_in_history: messageHistory.length
  };
}

// === Tool Definitions ===

export const bridgeTools = [
  {
    name: 'bridge_send',
    description: 'Send a message from one Society to another. Supports priorities and TTL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from_society: { type: 'string', description: 'Sender Society name' },
        to_society: { type: 'string', description: 'Recipient Society name' },
        type: { type: 'string', enum: ['DATA_SHARE', 'REQUEST', 'RESPONSE', 'NOTIFICATION'], description: 'Message type' },
        payload: { type: 'object', description: 'Message payload data' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Message priority' },
        ttl: { type: 'number', description: 'Time to live in seconds (default: 3600)' }
      },
      required: ['from_society', 'to_society', 'payload']
    }
  },
  {
    name: 'bridge_receive',
    description: 'Receive pending messages for a Society. Optionally acknowledge receipt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Society to receive messages for' },
        limit: { type: 'number', description: 'Max messages to retrieve (default: 10)' },
        acknowledge: { type: 'boolean', description: 'Mark messages as acknowledged' }
      },
      required: ['society']
    }
  },
  {
    name: 'bridge_context_share',
    description: 'Share context data with other Societies. Supports TTL for auto-expiry.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        owner_society: { type: 'string', description: 'Society sharing the context' },
        share_with: { type: 'array', items: { type: 'string' }, description: 'Societies to share with' },
        context_type: { type: 'string', description: 'Type of context (e.g., task_state, analysis_result)' },
        data: { type: 'object', description: 'Context data to share' },
        ttl: { type: 'number', description: 'Time to live in seconds' }
      },
      required: ['owner_society', 'share_with', 'context_type', 'data']
    }
  },
  {
    name: 'bridge_context_get',
    description: 'Retrieve shared context. Can get specific context by ID or list accessible contexts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        context_id: { type: 'string', description: 'Specific context ID to retrieve' },
        society: { type: 'string', description: 'Society requesting context' },
        context_type: { type: 'string', description: 'Filter by context type' }
      },
      required: ['society']
    }
  },
  {
    name: 'bridge_queue_status',
    description: 'Get status of the message queue. Shows depth, priorities, and health.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Filter by Society (optional)' }
      }
    }
  },
  {
    name: 'bridge_history',
    description: 'Get message history. Filter by Society, time range, or limit.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Filter by Society' },
        from: { type: 'string', description: 'Start time (ISO8601)' },
        to: { type: 'string', description: 'End time (ISO8601)' },
        limit: { type: 'number', description: 'Max messages (default: 50)' }
      }
    }
  }
];
