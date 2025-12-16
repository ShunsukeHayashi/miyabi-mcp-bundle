/**
 * Context Foundation - Society Context Management
 * Issue #13: Society間コンテキスト共有基盤
 */

interface StoredContext {
  id: string;
  key: string;
  society: string;
  data: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
  expires_at?: string;
  shared_with: string[];
}

// In-memory storage
const contextStore: Map<string, StoredContext> = new Map();

function generateId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanExpired(): void {
  const now = new Date().toISOString();
  for (const [id, ctx] of contextStore.entries()) {
    if (ctx.expires_at && ctx.expires_at < now) {
      contextStore.delete(id);
    }
  }
}

// === Handler Functions ===

export async function handleContextStore(params: {
  key: string;
  society: string;
  data: Record<string, unknown>;
  tags?: string[];
  ttl?: number;
  share_with?: string[];
}): Promise<object> {
  cleanExpired();
  
  // Check if key exists for this society, update if so
  let existing: StoredContext | undefined;
  for (const ctx of contextStore.values()) {
    if (ctx.key === params.key && ctx.society === params.society) {
      existing = ctx;
      break;
    }
  }

  const now = new Date().toISOString();
  const context: StoredContext = {
    id: existing?.id || generateId(),
    key: params.key,
    society: params.society,
    data: params.data,
    tags: params.tags || [],
    created_at: existing?.created_at || now,
    updated_at: now,
    expires_at: params.ttl 
      ? new Date(Date.now() + params.ttl * 1000).toISOString()
      : undefined,
    shared_with: params.share_with || []
  };

  contextStore.set(context.id, context);

  return {
    success: true,
    context_id: context.id,
    key: context.key,
    action: existing ? 'updated' : 'created',
    expires_at: context.expires_at
  };
}

export async function handleContextGet(params: {
  id?: string;
  key?: string;
  society: string;
}): Promise<object> {
  cleanExpired();

  if (params.id) {
    const ctx = contextStore.get(params.id);
    if (!ctx) {
      return { error: 'Context not found', id: params.id };
    }
    if (ctx.society !== params.society && !ctx.shared_with.includes(params.society)) {
      return { error: 'Access denied', id: params.id };
    }
    return { context: ctx };
  }

  if (params.key) {
    for (const ctx of contextStore.values()) {
      if (ctx.key === params.key && 
          (ctx.society === params.society || ctx.shared_with.includes(params.society))) {
        return { context: ctx };
      }
    }
    return { error: 'Context not found', key: params.key };
  }

  return { error: 'Either id or key required' };
}

export async function handleContextList(params: {
  society: string;
  tags?: string[];
  include_shared?: boolean;
}): Promise<object> {
  cleanExpired();

  let contexts = Array.from(contextStore.values()).filter(ctx =>
    ctx.society === params.society || 
    (params.include_shared && ctx.shared_with.includes(params.society))
  );

  if (params.tags && params.tags.length > 0) {
    contexts = contexts.filter(ctx =>
      params.tags!.some(tag => ctx.tags.includes(tag))
    );
  }

  return {
    society: params.society,
    contexts: contexts.map(ctx => ({
      id: ctx.id,
      key: ctx.key,
      tags: ctx.tags,
      created_at: ctx.created_at,
      expires_at: ctx.expires_at,
      is_shared: ctx.society !== params.society
    })),
    count: contexts.length
  };
}

export async function handleContextExpire(params: {
  id?: string;
  key?: string;
  society: string;
  new_ttl?: number;
}): Promise<object> {
  cleanExpired();

  let ctx: StoredContext | undefined;
  
  if (params.id) {
    ctx = contextStore.get(params.id);
  } else if (params.key) {
    for (const c of contextStore.values()) {
      if (c.key === params.key && c.society === params.society) {
        ctx = c;
        break;
      }
    }
  }

  if (!ctx) {
    return { error: 'Context not found' };
  }

  if (ctx.society !== params.society) {
    return { error: 'Only owner can modify expiration' };
  }

  if (params.new_ttl === 0) {
    // Delete immediately
    contextStore.delete(ctx.id);
    return { success: true, action: 'deleted', id: ctx.id };
  }

  if (params.new_ttl) {
    ctx.expires_at = new Date(Date.now() + params.new_ttl * 1000).toISOString();
    ctx.updated_at = new Date().toISOString();
    return { success: true, action: 'updated', id: ctx.id, new_expires_at: ctx.expires_at };
  }

  // Remove expiration
  ctx.expires_at = undefined;
  ctx.updated_at = new Date().toISOString();
  return { success: true, action: 'made_permanent', id: ctx.id };
}

export async function handleContextShare(params: {
  id?: string;
  key?: string;
  society: string;
  share_with: string[];
  revoke?: boolean;
}): Promise<object> {
  cleanExpired();

  let ctx: StoredContext | undefined;
  
  if (params.id) {
    ctx = contextStore.get(params.id);
  } else if (params.key) {
    for (const c of contextStore.values()) {
      if (c.key === params.key && c.society === params.society) {
        ctx = c;
        break;
      }
    }
  }

  if (!ctx) {
    return { error: 'Context not found' };
  }

  if (ctx.society !== params.society) {
    return { error: 'Only owner can modify sharing' };
  }

  if (params.revoke) {
    ctx.shared_with = ctx.shared_with.filter(s => !params.share_with.includes(s));
  } else {
    const newShares = params.share_with.filter(s => !ctx!.shared_with.includes(s));
    ctx.shared_with.push(...newShares);
  }

  ctx.updated_at = new Date().toISOString();

  return {
    success: true,
    id: ctx.id,
    action: params.revoke ? 'revoked' : 'shared',
    shared_with: ctx.shared_with
  };
}

export async function handleContextSearch(params: {
  society: string;
  query: string;
  tags?: string[];
  include_shared?: boolean;
}): Promise<object> {
  cleanExpired();

  const queryLower = params.query.toLowerCase();
  
  let contexts = Array.from(contextStore.values()).filter(ctx =>
    ctx.society === params.society || 
    (params.include_shared && ctx.shared_with.includes(params.society))
  );

  // Simple text search in key, tags, and data
  contexts = contexts.filter(ctx => {
    if (ctx.key.toLowerCase().includes(queryLower)) return true;
    if (ctx.tags.some(t => t.toLowerCase().includes(queryLower))) return true;
    const dataStr = JSON.stringify(ctx.data).toLowerCase();
    if (dataStr.includes(queryLower)) return true;
    return false;
  });

  if (params.tags && params.tags.length > 0) {
    contexts = contexts.filter(ctx =>
      params.tags!.some(tag => ctx.tags.includes(tag))
    );
  }

  return {
    query: params.query,
    society: params.society,
    results: contexts.map(ctx => ({
      id: ctx.id,
      key: ctx.key,
      tags: ctx.tags,
      preview: JSON.stringify(ctx.data).slice(0, 100),
      score: ctx.key.toLowerCase().includes(queryLower) ? 1.0 : 0.5
    })),
    count: contexts.length
  };
}

// === Tool Definitions ===

export const contextTools = [
  {
    name: 'context_store',
    description: 'Store context data with optional TTL and sharing settings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Unique key for this context' },
        society: { type: 'string', description: 'Owner Society' },
        data: { type: 'object', description: 'Context data to store' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        ttl: { type: 'number', description: 'Time to live in seconds' },
        share_with: { type: 'array', items: { type: 'string' }, description: 'Societies to share with' }
      },
      required: ['key', 'society', 'data']
    }
  },
  {
    name: 'context_get',
    description: 'Retrieve stored context by ID or key.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Context ID' },
        key: { type: 'string', description: 'Context key' },
        society: { type: 'string', description: 'Requesting Society' }
      },
      required: ['society']
    }
  },
  {
    name: 'context_list',
    description: 'List all contexts accessible to a Society.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Society to list contexts for' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        include_shared: { type: 'boolean', description: 'Include shared contexts' }
      },
      required: ['society']
    }
  },
  {
    name: 'context_expire',
    description: 'Manage context expiration. Set TTL, remove expiration, or delete.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Context ID' },
        key: { type: 'string', description: 'Context key' },
        society: { type: 'string', description: 'Owner Society' },
        new_ttl: { type: 'number', description: 'New TTL (0 to delete, omit to make permanent)' }
      },
      required: ['society']
    }
  },
  {
    name: 'context_share',
    description: 'Share or revoke context access with other Societies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Context ID' },
        key: { type: 'string', description: 'Context key' },
        society: { type: 'string', description: 'Owner Society' },
        share_with: { type: 'array', items: { type: 'string' }, description: 'Societies to share with' },
        revoke: { type: 'boolean', description: 'Revoke instead of grant' }
      },
      required: ['society', 'share_with']
    }
  },
  {
    name: 'context_search',
    description: 'Search contexts by text query across keys, tags, and data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        society: { type: 'string', description: 'Requesting Society' },
        query: { type: 'string', description: 'Search query' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        include_shared: { type: 'boolean', description: 'Include shared contexts' }
      },
      required: ['society', 'query']
    }
  }
];
