#!/usr/bin/env node
/**
 * Indexify Smart Trading Monitor
 * 
 * Monitors positions and executes automated exits based on configurable profiles.
 * Supports multiple trading strategies: ETF, meme, moonbag, scalp, swing, etc.
 * 
 * Usage:
 *   trade-monitor.js add <stackId> <entryPrice> [--profile <name>]
 *   trade-monitor.js check
 *   trade-monitor.js list
 *   trade-monitor.js profiles
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, '..', 'trade-config.json');
const STATE_PATH = path.join(__dirname, '..', 'trade-state.json');
const API_SCRIPT = path.join(__dirname, 'indexify-api.js');

// ============================================================================
// CONFIG & STATE MANAGEMENT
// ============================================================================

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
  return getDefaultConfig();
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
  } catch (e) {}
  return { 
    positions: {},
    executedOrders: [],
    lastCheck: null
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function getDefaultConfig() {
  return {
    enabled: true,
    defaultProfile: 'etf',
    profiles: {
      etf: {
        name: 'ETF / Index',
        scenarios: {
          takeProfit: [
            {triggerPct: 10, sellPct: 25}, {triggerPct: 20, sellPct: 25},
            {triggerPct: 35, sellPct: 25}, {triggerPct: 50, sellPct: 25}
          ],
          stopLoss: {triggerPct: -15, sellPct: 100},
          trailingStop: {activateAtPct: 15, trailPct: 8, sellPct: 100}
        }
      }
    },
    positions: []
  };
}

// ============================================================================
// API HELPERS
// ============================================================================

function runApi(args) {
  try {
    const result = execSync(`node "${API_SCRIPT}" ${args}`, { 
      encoding: 'utf8', 
      timeout: 30000,
      env: { ...process.env }
    });
    return JSON.parse(result);
  } catch (e) {
    // Try to parse JSON from stderr/stdout
    const output = e.stdout || e.stderr || '';
    try { return JSON.parse(output); } catch {}
    console.error(`API call failed: ${args}`);
    return null;
  }
}

function getStackPrice(stackId) {
  const data = runApi(`stacks fetch '{"id":${stackId}}'`);
  if (data && data.price) return data.price;
  if (data && Array.isArray(data) && data[0]?.price) return data[0].price;
  return null;
}

function getStackInfo(stackId) {
  return runApi(`stacks fetch '{"id":${stackId}}'`);
}

function executeSell(stackId, percent, reason) {
  console.log(`🔴 SELL ${percent}% of stack ${stackId}: ${reason}`);
  const result = runApi(`trade sell ${stackId} ${percent}`);
  if (result && (result.order_id || result.success)) {
    console.log(`   Order: ${result.order_id || 'submitted'}`);
    return result.order_id || 'submitted';
  }
  console.log(`   ⚠️  Sell may have failed`);
  return null;
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

function getProfile(config, profileName) {
  const name = profileName || config.defaultProfile || 'etf';
  const profile = config.profiles?.[name];
  if (!profile) {
    console.error(`Profile "${name}" not found. Available: ${Object.keys(config.profiles || {}).join(', ')}`);
    return null;
  }
  return { name, ...profile };
}

function listProfiles(config) {
  console.log('\n📊 AVAILABLE TRADING PROFILES\n');
  console.log('=' .repeat(70));
  
  for (const [key, profile] of Object.entries(config.profiles || {})) {
    const scenarios = profile.scenarios || {};
    const tp = scenarios.takeProfit || [];
    const sl = scenarios.stopLoss;
    const ts = scenarios.trailingStop;
    
    console.log(`\n${key.toUpperCase()} - ${profile.name}`);
    console.log('-'.repeat(40));
    console.log(`  ${profile.description || ''}`);
    if (profile.bestFor?.length) {
      console.log(`  Best for: ${profile.bestFor.join(', ')}`);
    }
    console.log('');
    
    if (tp.length) {
      console.log('  Take Profit Ladder:');
      tp.forEach(t => console.log(`    +${t.triggerPct}% → sell ${t.sellPct}%`));
    }
    
    if (sl) {
      console.log(`  Stop Loss: ${sl.triggerPct}% → sell ${sl.sellPct}%`);
    }
    
    if (ts) {
      console.log(`  Trailing Stop: ${ts.trailPct}% trail after +${ts.activateAtPct}%`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`Default profile: ${config.defaultProfile || 'etf'}`);
  console.log('\nUsage: trade-monitor.js add <stackId> <price> --profile meme');
}

// ============================================================================
// POSITION MONITORING
// ============================================================================

function checkPosition(stackId, position, config, state) {
  const currentPrice = getStackPrice(stackId);
  if (!currentPrice) {
    console.log(`⚠️  Could not get price for stack ${stackId}`);
    return;
  }

  const entryPrice = position.entryPrice;
  const changePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const peakPrice = Math.max(position.peakPrice || entryPrice, currentPrice);
  
  // Update peak price in state
  state.positions[stackId].peakPrice = peakPrice;
  
  const profile = getProfile(config, position.profile);
  if (!profile) return;
  
  const scenarios = profile.scenarios;
  const executedStages = position.takeProfitStages || [];

  console.log(`📊 Stack ${stackId} [${profile.name}]`);
  console.log(`   Entry: $${entryPrice.toFixed(4)} → Current: $${currentPrice.toFixed(4)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);
  console.log(`   Peak: $${peakPrice.toFixed(4)} | TP stages hit: ${executedStages.length}`);

  // 1. Check stop loss first (highest priority)
  if (scenarios.stopLoss && changePct <= scenarios.stopLoss.triggerPct) {
    const orderId = executeSell(stackId, scenarios.stopLoss.sellPct, 
      `Stop loss at ${scenarios.stopLoss.triggerPct}%`);
    if (orderId) {
      state.executedOrders.push({
        type: 'stopLoss',
        stackId,
        profile: position.profile,
        orderId,
        entryPrice,
        exitPrice: currentPrice,
        changePct,
        timestamp: Date.now()
      });
      delete state.positions[stackId];
    }
    return;
  }

  // 2. Check trailing stop
  if (scenarios.trailingStop && changePct >= scenarios.trailingStop.activateAtPct) {
    const dropFromPeakPct = ((peakPrice - currentPrice) / peakPrice) * 100;
    
    if (dropFromPeakPct >= scenarios.trailingStop.trailPct) {
      const peakChangePct = ((peakPrice - entryPrice) / entryPrice) * 100;
      const orderId = executeSell(stackId, scenarios.trailingStop.sellPct, 
        `Trailing stop (${scenarios.trailingStop.trailPct}% from peak of +${peakChangePct.toFixed(1)}%)`);
      if (orderId) {
        state.executedOrders.push({
          type: 'trailingStop',
          stackId,
          profile: position.profile,
          orderId,
          entryPrice,
          exitPrice: currentPrice,
          peakPrice,
          changePct,
          timestamp: Date.now()
        });
        delete state.positions[stackId];
      }
      return;
    }
  }

  // 3. Check take profit ladder
  if (scenarios.takeProfit && scenarios.takeProfit.length > 0) {
    for (const tp of scenarios.takeProfit) {
      const stageKey = `tp_${tp.triggerPct}`;
      if (!executedStages.includes(stageKey) && changePct >= tp.triggerPct) {
        const orderId = executeSell(stackId, tp.sellPct, 
          `Take profit at +${tp.triggerPct}%`);
        if (orderId) {
          state.positions[stackId].takeProfitStages.push(stageKey);
          state.executedOrders.push({
            type: 'takeProfit',
            stackId,
            profile: position.profile,
            orderId,
            entryPrice,
            exitPrice: currentPrice,
            changePct,
            stage: tp.triggerPct,
            sellPct: tp.sellPct,
            timestamp: Date.now()
          });
        }
      }
    }
  }
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

function addPosition(stackId, entryPrice, profileName) {
  const config = loadConfig();
  const state = loadState();
  
  // Validate profile exists
  const profile = getProfile(config, profileName);
  if (!profile && profileName) {
    process.exit(1);
  }
  
  const finalProfile = profileName || config.defaultProfile || 'etf';
  
  // Get stack info
  const stackInfo = getStackInfo(stackId);
  const stackName = stackInfo?.name || stackInfo?.stack_name || `Stack ${stackId}`;
  
  state.positions[stackId] = {
    stackId,
    stackName,
    entryPrice,
    entryTime: Date.now(),
    peakPrice: entryPrice,
    profile: finalProfile,
    takeProfitStages: []
  };
  saveState(state);
  
  const pf = config.profiles[finalProfile];
  console.log(`\n✅ Position added`);
  console.log(`   Stack: ${stackName} (${stackId})`);
  console.log(`   Entry: $${entryPrice}`);
  console.log(`   Profile: ${finalProfile} - ${pf?.name || ''}`);
  
  if (pf?.scenarios) {
    const tp = pf.scenarios.takeProfit || [];
    const sl = pf.scenarios.stopLoss;
    const ts = pf.scenarios.trailingStop;
    
    console.log(`\n   Exit strategy:`);
    if (tp.length) console.log(`   • TP: ${tp.map(t => `+${t.triggerPct}%`).join(' → ')}`);
    if (sl) console.log(`   • SL: ${sl.triggerPct}%`);
    if (ts) console.log(`   • Trail: ${ts.trailPct}% after +${ts.activateAtPct}%`);
  }
}

function listPositions() {
  const state = loadState();
  const config = loadConfig();
  
  console.log('\n📈 ACTIVE POSITIONS\n');
  
  if (Object.keys(state.positions).length === 0) {
    console.log('No positions tracked.');
    console.log('\nAdd with: trade-monitor.js add <stackId> <entryPrice> [--profile <name>]');
    console.log('Profiles: trade-monitor.js profiles');
    return;
  }

  for (const [stackId, pos] of Object.entries(state.positions)) {
    const currentPrice = getStackPrice(stackId);
    const changePct = currentPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : null;
    const profile = config.profiles?.[pos.profile];
    
    console.log(`${pos.stackName || 'Stack ' + stackId} (${stackId})`);
    console.log(`  Profile: ${pos.profile} (${profile?.name || 'unknown'})`);
    console.log(`  Entry: $${pos.entryPrice.toFixed(4)} @ ${new Date(pos.entryTime).toLocaleDateString()}`);
    if (currentPrice) {
      const arrow = changePct >= 0 ? '↑' : '↓';
      const color = changePct >= 0 ? '+' : '';
      console.log(`  Current: $${currentPrice.toFixed(4)} ${arrow} ${color}${changePct.toFixed(2)}%`);
    }
    console.log(`  Peak: $${(pos.peakPrice || pos.entryPrice).toFixed(4)}`);
    console.log(`  TP stages hit: ${pos.takeProfitStages?.length || 0}`);
    console.log('');
  }
}

function runCheck() {
  const config = loadConfig();
  const state = loadState();
  
  if (!config.enabled) {
    console.log('Monitor disabled in config');
    return;
  }

  const posCount = Object.keys(state.positions).length;
  console.log(`\n🔄 Checking ${posCount} position(s) at ${new Date().toISOString()}\n`);
  
  if (posCount === 0) {
    console.log('No positions to monitor.');
    return;
  }
  
  for (const [stackId, position] of Object.entries(state.positions)) {
    checkPosition(stackId, position, config, state);
    console.log('');
  }
  
  state.lastCheck = Date.now();
  saveState(state);
}

function showHistory(limit = 20) {
  const state = loadState();
  console.log('\n📜 TRADE HISTORY\n');
  
  const orders = (state.executedOrders || []).slice(-limit).reverse();
  
  if (orders.length === 0) {
    console.log('No executed orders yet.');
    return;
  }
  
  for (const order of orders) {
    const date = new Date(order.timestamp).toLocaleString();
    const pnl = order.changePct ? `${order.changePct >= 0 ? '+' : ''}${order.changePct.toFixed(2)}%` : 'N/A';
    const type = order.type.toUpperCase().padEnd(12);
    console.log(`${date} | ${type} | Stack ${order.stackId} | ${pnl} | ${order.profile || 'default'}`);
  }
}

function showConfig() {
  const config = loadConfig();
  console.log(JSON.stringify(config, null, 2));
}

function setDefaultProfile(profileName) {
  const config = loadConfig();
  if (!config.profiles?.[profileName]) {
    console.error(`Profile "${profileName}" not found.`);
    console.log(`Available: ${Object.keys(config.profiles || {}).join(', ')}`);
    process.exit(1);
  }
  config.defaultProfile = profileName;
  saveConfig(config);
  console.log(`✅ Default profile set to: ${profileName}`);
}

function removePosition(stackId) {
  const state = loadState();
  if (!state.positions[stackId]) {
    console.log(`No position found for stack ${stackId}`);
    return;
  }
  const pos = state.positions[stackId];
  delete state.positions[stackId];
  saveState(state);
  console.log(`✅ Removed position: ${pos.stackName || stackId}`);
}

// ============================================================================
// MAIN CLI PARSER
// ============================================================================

function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(args[i]);
    }
  }
  return result;
}

function printHelp() {
  console.log(`
Indexify Smart Trading Monitor
==============================

COMMANDS:
  add <stackId> <price> [--profile <name>]   Add position with exit strategy
  remove <stackId>                           Remove position
  list                                       Show active positions
  check                                      Run exit check (cron this)
  profiles                                   List all trading profiles
  set-default <profile>                      Set default profile
  history [limit]                            Show executed orders
  config                                     Show full config

PROFILES:
  etf           Conservative for diversified stacks (TP: +10→50%, SL: -15%)
  meme          High volatility plays (TP: +50→500%, SL: -40%)
  moonbag       Recover principal, let rest ride (TP: +100% sell 50%)
  scalp         Quick in/out (TP: +3-5%, SL: -3%)
  swing         Multi-day trends (TP: +20→75%, SL: -12%)
  conservative  Capital preservation (TP: +5-10%, SL: -5%)
  trailing_only Pure trailing stop, no fixed TP
  dca_out       Gradual exit regardless of price

EXAMPLES:
  trade-monitor.js add 280 1.50 --profile meme
  trade-monitor.js add 274 2.00 --profile etf
  trade-monitor.js check
  trade-monitor.js profiles

AUTOMATION:
  Run 'trade-monitor.js check' via cron every 1-5 minutes.
`);
}

// Main
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

switch (cmd) {
  case 'add':
    const stackId = args._[1];
    const entryPrice = parseFloat(args._[2]);
    if (!stackId || isNaN(entryPrice)) {
      console.log('Usage: trade-monitor.js add <stackId> <entryPrice> [--profile <name>]');
      process.exit(1);
    }
    addPosition(stackId, entryPrice, args.profile);
    break;
    
  case 'remove':
    if (!args._[1]) {
      console.log('Usage: trade-monitor.js remove <stackId>');
      process.exit(1);
    }
    removePosition(args._[1]);
    break;
    
  case 'list':
    listPositions();
    break;
    
  case 'check':
    runCheck();
    break;
    
  case 'profiles':
    listProfiles(loadConfig());
    break;
    
  case 'set-default':
    if (!args._[1]) {
      console.log('Usage: trade-monitor.js set-default <profile>');
      process.exit(1);
    }
    setDefaultProfile(args._[1]);
    break;
    
  case 'config':
    showConfig();
    break;
    
  case 'history':
    showHistory(parseInt(args._[1]) || 20);
    break;
    
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
    
  default:
    printHelp();
}
