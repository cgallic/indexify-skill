#!/usr/bin/env node
/**
 * Indexify Quick Trade - Simple commands for agents
 * Usage: quick-trade.js <action> [args]
 */

const { execSync } = require('child_process');
const SCRIPT = '/root/clawd/skills/indexify/scripts/indexify.sh';

function run(cmd) {
  try {
    return JSON.parse(execSync(`${SCRIPT} ${cmd}`, { encoding: 'utf8', timeout: 30000 }));
  } catch (e) {
    return { error: e.message };
  }
}

function formatUSD(n) {
  return '$' + (n || 0).toFixed(2);
}

const actions = {
  // Get account status
  status: () => {
    const bal = run('trade balance');
    const usdc = bal?.find?.(t => t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const addr = run('trade address');
    console.log(`Wallet: ${addr?.pubkey || 'unknown'}`);
    console.log(`USDC: ${formatUSD(usdc?.amount)}`);
  },

  // Show official stacks
  official: () => {
    const stacks = run('stacks official --limit 5');
    console.log('Official Stacks (curated ETFs):');
    (stacks || []).forEach(s => {
      const change = (s.change1D * 100).toFixed(2);
      const arrow = s.change1D >= 0 ? '↑' : '↓';
      console.log(`  [${s.id}] ${s.stack_name} ${arrow}${change}%`);
    });
  },

  // Show trending
  trending: () => {
    const stacks = run('stacks trending --limit 5');
    console.log('Trending Stacks:');
    (stacks || []).forEach(s => {
      const change = ((s.change1D || 0) * 100).toFixed(2);
      console.log(`  [${s.id}] ${s.stack_name} +${change}%`);
    });
  },

  // Buy a stack
  buy: (stackId, amount) => {
    if (!stackId || !amount) {
      console.log('Usage: quick-trade.js buy <stackId> <usdcAmount>');
      return;
    }
    console.log(`Buying $${amount} of stack ${stackId}...`);
    const result = run(`trade buy --stack ${stackId} --amount ${amount}`);
    if (result?.order_id) {
      console.log(`✅ Order placed: ${result.order_id}`);
    } else {
      console.log('❌ Failed:', result?.error || 'Unknown error');
    }
  },

  // Sell a stack
  sell: (stackId, percent) => {
    if (!stackId || !percent) {
      console.log('Usage: quick-trade.js sell <stackId> <percent>');
      return;
    }
    console.log(`Selling ${percent}% of stack ${stackId}...`);
    const result = run(`trade sell --stack ${stackId} --percent ${percent}`);
    if (result?.order_id) {
      console.log(`✅ Order placed: ${result.order_id}`);
    } else {
      console.log('❌ Failed:', result?.error || 'Unknown error');
    }
  },

  // Check a specific stack
  stack: (idOrSlug) => {
    if (!idOrSlug) {
      console.log('Usage: quick-trade.js stack <id or slug>');
      return;
    }
    const isNum = /^\d+$/.test(idOrSlug);
    const result = run(isNum ? `stacks fetch --id ${idOrSlug}` : `stacks fetch --slug ${idOrSlug}`);
    const s = result?.[0];
    if (!s) {
      console.log('Stack not found');
      return;
    }
    console.log(`${s.stack_name} (ID: ${s.id})`);
    console.log(`Price: $${s.price?.toFixed(4) || '?'}`);
    console.log(`24h: ${((s.change1D || 0) * 100).toFixed(2)}%`);
    console.log(`Creator fee: ${(s.creator_fee * 100).toFixed(1)}%`);
    if (s.tokens?.length) {
      console.log(`Tokens: ${s.tokens.map(t => t.symbol).join(', ')}`);
    }
  },

  // View recent orders
  orders: () => {
    const result = run('orders list');
    const orders = result?.orders?.slice(0, 5) || [];
    if (!orders.length) {
      console.log('No recent orders');
      return;
    }
    console.log('Recent Orders:');
    orders.forEach(o => {
      console.log(`  ${o.order_id} | ${o.type} | ${o.status} | ${o.stack_name || 'Stack ' + o.stack_id}`);
    });
  },

  // Portfolio summary
  portfolio: () => {
    const holdings = run('portfolio holdings');
    if (holdings?.error) {
      console.log('Error fetching portfolio');
      return;
    }
    console.log(`Total Value: ${formatUSD(holdings?.grand_total_stack_value)}`);
    console.log(`Cash: ${formatUSD(holdings?.total_cash_value)}`);
    const stacks = holdings?.stacks?.filter(s => !s.is_company_stack) || [];
    if (stacks.length) {
      console.log('Positions:');
      stacks.forEach(s => {
        console.log(`  ${s.stack_name}: ${formatUSD(s.total_stack_value)} (${((s.profit_loss_percent || 0) * 100).toFixed(1)}%)`);
      });
    }
  },

  help: () => {
    console.log(`
Indexify Quick Trade

COMMANDS:
  status              Account balance and wallet
  official            List official (curated) stacks
  trending            List trending stacks
  stack <id|slug>     Get stack details
  buy <id> <amount>   Buy USDC amount of stack
  sell <id> <pct>     Sell percentage of stack
  orders              Recent orders
  portfolio           Your holdings

EXAMPLES:
  quick-trade.js status
  quick-trade.js buy 280 10       # Buy $10 of Solana Meme Index
  quick-trade.js sell 280 50      # Sell 50%
  quick-trade.js stack solana-meme-index
`);
  }
};

const [,, action, ...args] = process.argv;
const fn = actions[action] || actions.help;
fn(...args);
