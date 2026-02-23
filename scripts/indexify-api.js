#!/usr/bin/env node
/**
 * Indexify Full API Client
 * Complete coverage of the Indexify platform
 */

const https = require('https');
const fs = require('fs');

const API_BASE = 'https://api.indexify.finance';
const API_KEY = process.env.INDEXIFY_API_KEY || (() => {
  // Try common secret locations
  const paths = [
    process.env.HOME + '/.secrets/indexify-api-key',
    process.env.HOME + '/.indexify-key',
    './.indexify-key'
  ];
  for (const p of paths) {
    try { return fs.readFileSync(p, 'utf8').trim(); } catch {}
  }
  throw new Error('INDEXIFY_API_KEY not set. Export it or save to ~/.secrets/indexify-api-key');
})();

// HTTP request helper
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const api = {
  // ============ ACCOUNT ============
  account: {
    // Get authenticated user profile
    fetch: () => request('POST', '/api/user_info.php?action=fetch', {}),
    
    // Update profile
    update: (data) => request('POST', '/api/user_info.php?action=update', data),
    
    // Check username availability
    checkName: (name) => request('POST', '/api/user_info.php?action=check_name', { name }),
    
    // Search users
    search: (query, limit = 20) => request('POST', `/api/user_info.php?action=search&query=${encodeURIComponent(query)}&limit=${limit}`),
    
    // Get public profile by username
    profile: (username) => request('POST', '/api/user_info.php?action=public_profile', { username }),
  },

  // ============ NOTIFICATIONS ============
  notifications: {
    list: (page = 1, limit = 20) => request('POST', '/api/notifications.php?action=get_notifications', { page, limit }),
    unreadCount: () => request('POST', '/api/notifications.php?action=get_unread_count', {}),
    markRead: (id) => request('POST', '/api/notifications.php?action=mark_read', { notification_id: id }),
    markAllRead: () => request('POST', '/api/notifications.php?action=mark_all_read', {}),
  },

  // ============ STACKS ============
  stacks: {
    // Discovery
    list: (opts = {}) => request('POST', '/api/stack_info.php?action=paginated_list', {
      limit: opts.limit || 20,
      offset: opts.offset || 0,
      sort: opts.sort || 'change1D',
      order: opts.order || 'DESC',
      ...opts
    }),
    
    trending: (limit = 10, offset = 0) => request('POST', '/api/stack_info.php?action=trending', { limit, offset }),
    
    official: (limit = 10, offset = 0) => request('POST', '/api/stack_info.php?action=official', { limit, offset }),
    
    // Fetch by ID or slug
    fetch: (opts) => {
      const body = {};
      if (opts.id) body.stackIds = [opts.id];
      if (opts.slug) body.slugs = [opts.slug];
      if (opts.ids) body.stackIds = opts.ids;
      if (opts.slugs) body.slugs = opts.slugs;
      return request('POST', '/api/stack_info.php?action=fetch', body);
    },
    
    // Related stacks by token
    related: (tokenAddress, limit = 10) => request('POST', '/api/stack_info.php?action=related_stacks', {
      token_address: tokenAddress,
      limit
    }),
    
    // My created stacks
    mine: (limit = 20, offset = 0) => request('POST', '/api/stack_info.php?action=my_stacks', { limit, offset }),
    
    // Create stack
    create: (data) => request('POST', '/api/stack_info.php?action=create', data),
    
    // Update stack metadata
    update: (stackId, data) => request('POST', '/api/stack_info.php?action=update', { stack_id: stackId, ...data }),
    
    // Edit token allocation
    editAllocation: (stackId, tokenWeights, note = '') => request('POST', '/api/stack_info.php?action=edit_allocation', {
      stack_id: stackId,
      stackTokenInfo: tokenWeights,
      creator_note: note
    }),
    
    // Close stack
    close: (stackId, note = '') => request('POST', '/api/stack_info.php?action=close', {
      stack_id: stackId,
      creator_note: note
    }),
    
    // Version history
    versionHistory: (stackId) => request('POST', '/api/stack_info.php?action=version_history', { stack_id: stackId }),
    
    // Get user holdings in stack
    holdings: (stackId) => request('POST', '/api/stack_info.php?action=user_stack_holdings', { stack_id: stackId }),
    
    // Get stack investors count
    investors: (stackId) => request('POST', '/api/stack_info.php?action=investors', { stack_id: stackId }),
    
    // Get stack followers count
    followers: (stackId) => request('POST', '/api/stack_info.php?action=followers', { stack_id: stackId }),
    
    // Validation
    checkName: (name) => request('POST', '/api/stack_info.php?action=check_name', { name }),
    checkDescription: (desc) => request('POST', '/api/stack_info.php?action=check_description', { description: desc }),
  },

  // ============ TOKENS ============
  tokens: {
    list: (limit = 50, offset = 0) => request('POST', '/api/token_info.php?action=paginated_list', { limit, offset }),
    
    search: (query, limit = 20) => request('POST', '/api/token_info.php?action=search', { query, limit }),
    
    fetch: (address) => request('POST', '/api/token_info.php?action=fetch', { address }),
    
    // Get token by ID
    byId: (id) => request('POST', '/api/token_info.php?action=fetch_by_id', { token_id: id }),
    
    // Categories
    categories: () => request('POST', '/api/token_info.php?action=categories', {}),
  },

  // ============ TRADING ============
  trade: {
    // Get all balances
    balance: () => request('POST', '/api/txn.php?action=balance', {}),
    
    // Get USDC balance
    usdcBalance: () => request('POST', '/api/txn.php?action=usdc_balance', {}),
    
    // Get total balance in USDC
    totalBalance: () => request('POST', '/api/txn.php?action=total_balance', {}),
    
    // Get wallet address
    address: () => request('POST', '/api/txn.php?action=address', {}),
    
    // Buy stack (spend USDC)
    buy: (stackId, usdcAmount) => request('POST', '/api/txn.php?action=swap', {
      stack_id: stackId,
      amount: usdcAmount,
      cue: 'fromUSDC'
    }),
    
    // Sell stack (percentage)
    sell: (stackId, percent) => request('POST', '/api/txn.php?action=swap', {
      stack_id: stackId,
      amount: percent,
      cue: 'toUSDC'
    }),
    
    // Rebalance holdings to target allocation
    rebalance: (stackId) => request('POST', '/api/txn.php?action=rebalance', { stack_id: stackId }),
  },

  // ============ ORDERS ============
  orders: {
    list: (limit = 100, offset = 0) => request('POST', `/api/user_orders.php?offset=${offset}&limit=${limit}`, {}),
    
    details: (orderId) => request('POST', '/api/orders.php?action=details', { order_id: orderId }),
    
    status: (orderId) => request('POST', '/api/orders.php?action=status', { order_id: orderId }),
    
    partialDetails: (orderId) => request('POST', '/api/orders.php?action=partial_details', { order_id: orderId }),
    
    acknowledge: (orderId) => request('POST', '/api/orders.php?action=acknowledge', { order_id: orderId }),
    
    retry: (orderId, slippage = null) => {
      const body = { order_id: orderId };
      if (slippage) body.slippage = slippage;
      return request('POST', '/api/orders.php?action=retry', body);
    },
    
    sellAll: (orderId) => request('POST', '/api/orders.php?action=sell_all', { order_id: orderId }),
    
    retryChain: (orderId) => request('POST', '/api/orders.php?action=retry_chain', { order_id: orderId }),
  },

  // ============ TRANSACTION HISTORY ============
  history: {
    list: (opts = {}) => {
      const params = new URLSearchParams({
        action: 'list',
        limit: opts.limit || 20,
        offset: opts.offset || 0
      });
      if (opts.type) params.set('type', opts.type);
      if (opts.status) params.set('status', opts.status);
      if (opts.stackId) params.set('stack_id', opts.stackId);
      return request('GET', `/api/transaction_history.php?${params}`);
    },
    
    detail: (orderId) => request('GET', `/api/transaction_history.php?action=detail&order_id=${orderId}`),
    
    summary: () => request('GET', '/api/transaction_history.php?action=summary'),
  },

  // ============ FEES ============
  fees: {
    calculate: (stackId, amount) => request('POST', '/api/fee.php?action=calculate', {
      stack_id: stackId,
      amount
    }),
    
    minBuy: () => request('POST', '/api/fee.php?action=min_buy', {}),
    
    creatorFeeBounds: () => request('POST', '/api/fee.php?action=creator_fee_bounds', {}),
  },

  // ============ PORTFOLIO ============
  portfolio: {
    holdings: () => request('POST', '/api/portfolio.php?action=holdings', {}),
  },

  // ============ SOCIAL ============
  social: {
    // Follow a stack
    follow: (stackId) => request('POST', '/api/follow.php?action=follow', { stack_id: stackId }),
    
    // Unfollow
    unfollow: (stackId) => request('POST', '/api/follow.php?action=unfollow', { stack_id: stackId }),
    
    // Check if following
    isFollowing: (stackId) => request('POST', '/api/follow.php?action=check', { stack_id: stackId }),
    
    // Get followed stacks
    following: (limit = 50, offset = 0) => request('POST', '/api/follow.php?action=list', { limit, offset }),
  },

  // ============ CHAT ============
  chat: {
    // Get stack messages
    messages: (stackId, limit = 50) => request('POST', '/api/chat.php?action=messages', {
      stack_id: stackId,
      limit
    }),
    
    // Post message (creator only)
    post: (stackId, message, type = 'creator_notes') => request('POST', '/api/chat.php?action=post', {
      stack_id: stackId,
      message,
      message_type: type
    }),
  },

  // ============ REFERRALS ============
  referrals: {
    stats: () => request('POST', '/api/referrals.php?action=stats', {}),
    code: () => request('POST', '/api/referrals.php?action=code', {}),
  },
};

// CLI interface
async function main() {
  const [,, cmd, subcmd, ...args] = process.argv;
  
  if (!cmd || cmd === 'help') {
    console.log(`
Indexify Full API Client

USAGE: indexify-api.js <resource> <action> [args...]

RESOURCES:
  account       User profile & search
  notifications Notification management
  stacks        Stack discovery & management
  tokens        Token database & search
  trade         Trading operations
  orders        Order management
  history       Transaction history
  fees          Fee calculations
  portfolio     Holdings & P&L
  social        Follow/unfollow stacks
  chat          Stack messages
  referrals     Referral stats

EXAMPLES:
  indexify-api.js account fetch
  indexify-api.js stacks trending
  indexify-api.js stacks search "meme"
  indexify-api.js tokens search "SOL"
  indexify-api.js trade buy 280 10
  indexify-api.js trade sell 280 50
  indexify-api.js orders list
  indexify-api.js portfolio holdings

Use as module:
  const api = require('./indexify-api.js');
  const stacks = await api.stacks.trending(10);
`);
    return;
  }

  const resource = api[cmd];
  if (!resource) {
    console.error(`Unknown resource: ${cmd}`);
    process.exit(1);
  }

  const action = resource[subcmd];
  if (!action) {
    console.error(`Unknown action: ${subcmd} for ${cmd}`);
    console.log(`Available actions: ${Object.keys(resource).join(', ')}`);
    process.exit(1);
  }

  try {
    const result = await action(...args.map(a => isNaN(a) ? a : Number(a)));
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = api;

// Run CLI if called directly
if (require.main === module) {
  main();
}
