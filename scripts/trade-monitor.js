#!/usr/bin/env node
/**
 * Indexify Smart Trading Monitor
 * Monitors positions and executes take-profit / stop-loss orders
 */

const fs = require('fs');
const { execSync } = require('child_process');

const CONFIG_PATH = '/root/clawd/skills/indexify/trade-config.json';
const STATE_PATH = '/root/clawd/skills/indexify/trade-state.json';
const SCRIPT = '/root/clawd/skills/indexify/scripts/indexify.sh';

// Default config
const DEFAULT_CONFIG = {
  enabled: true,
  checkIntervalMs: 60000, // 1 minute
  scenarios: {
    // Take profit ladder
    takeProfit: [
      { triggerPct: 15, sellPct: 25, note: "Lock 25% at +15%" },
      { triggerPct: 30, sellPct: 25, note: "Lock another 25% at +30%" },
      { triggerPct: 50, sellPct: 25, note: "Lock 25% at +50%" },
      { triggerPct: 100, sellPct: 25, note: "Moon bag exit at 2x" }
    ],
    // Stop loss
    stopLoss: {
      triggerPct: -20,
      sellPct: 100,
      note: "Cut losses at -20%"
    },
    // Trailing stop (activates after initial profit)
    trailingStop: {
      activateAtPct: 20,  // Start trailing after +20%
      trailPct: 10,       // Sell if drops 10% from peak
      sellPct: 100,
      note: "Trail 10% from peak after +20%"
    }
  },
  // Positions to monitor (auto-populated from trades)
  positions: []
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
  return DEFAULT_CONFIG;
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
    positions: {},  // stackId -> { entryPrice, entryTime, peakPrice, takeProfitStages: [] }
    executedOrders: [],
    lastCheck: null
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function runCmd(args) {
  try {
    const result = execSync(`${SCRIPT} ${args}`, { encoding: 'utf8', timeout: 30000 });
    return JSON.parse(result);
  } catch (e) {
    console.error(`Command failed: ${args}`, e.message);
    return null;
  }
}

function getStackPrice(stackId) {
  const data = runCmd(`stacks fetch --id ${stackId}`);
  if (data && Array.isArray(data) && data[0]) {
    return data[0].price;
  }
  return null;
}

function executeSell(stackId, percent, reason) {
  console.log(`🔴 SELL ${percent}% of stack ${stackId}: ${reason}`);
  const result = runCmd(`trade sell --stack ${stackId} --percent ${percent}`);
  if (result && result.order_id) {
    console.log(`   Order: ${result.order_id}`);
    return result.order_id;
  }
  return null;
}

function checkPosition(stackId, position, config, state) {
  const currentPrice = getStackPrice(stackId);
  if (!currentPrice) {
    console.log(`⚠️  Could not get price for stack ${stackId}`);
    return;
  }

  const entryPrice = position.entryPrice;
  const changePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const peakPrice = Math.max(position.peakPrice || entryPrice, currentPrice);
  
  // Update peak price
  state.positions[stackId].peakPrice = peakPrice;
  
  console.log(`📊 Stack ${stackId}: Entry $${entryPrice.toFixed(4)} → $${currentPrice.toFixed(4)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);

  const scenarios = config.scenarios;
  const executedStages = position.takeProfitStages || [];

  // Check stop loss first
  if (scenarios.stopLoss && changePct <= scenarios.stopLoss.triggerPct) {
    const orderId = executeSell(stackId, scenarios.stopLoss.sellPct, scenarios.stopLoss.note);
    if (orderId) {
      state.executedOrders.push({
        type: 'stopLoss',
        stackId,
        orderId,
        price: currentPrice,
        changePct,
        timestamp: Date.now()
      });
      // Remove position after full stop loss
      delete state.positions[stackId];
    }
    return;
  }

  // Check trailing stop
  if (scenarios.trailingStop && changePct >= scenarios.trailingStop.activateAtPct) {
    const peakChangePct = ((peakPrice - entryPrice) / entryPrice) * 100;
    const dropFromPeakPct = ((peakPrice - currentPrice) / peakPrice) * 100;
    
    if (dropFromPeakPct >= scenarios.trailingStop.trailPct) {
      const orderId = executeSell(stackId, scenarios.trailingStop.sellPct, 
        `${scenarios.trailingStop.note} (peak was +${peakChangePct.toFixed(1)}%)`);
      if (orderId) {
        state.executedOrders.push({
          type: 'trailingStop',
          stackId,
          orderId,
          price: currentPrice,
          peakPrice,
          changePct,
          timestamp: Date.now()
        });
        delete state.positions[stackId];
      }
      return;
    }
  }

  // Check take profit ladder
  if (scenarios.takeProfit) {
    for (const tp of scenarios.takeProfit) {
      const stageKey = `tp_${tp.triggerPct}`;
      if (!executedStages.includes(stageKey) && changePct >= tp.triggerPct) {
        const orderId = executeSell(stackId, tp.sellPct, tp.note);
        if (orderId) {
          state.positions[stackId].takeProfitStages.push(stageKey);
          state.executedOrders.push({
            type: 'takeProfit',
            stackId,
            orderId,
            price: currentPrice,
            changePct,
            stage: tp.triggerPct,
            timestamp: Date.now()
          });
        }
      }
    }
  }
}

function addPosition(stackId, entryPrice) {
  const state = loadState();
  state.positions[stackId] = {
    entryPrice,
    entryTime: Date.now(),
    peakPrice: entryPrice,
    takeProfitStages: []
  };
  saveState(state);
  console.log(`✅ Added position: Stack ${stackId} @ $${entryPrice}`);
}

function listPositions() {
  const state = loadState();
  const config = loadConfig();
  
  console.log('\n📈 ACTIVE POSITIONS\n');
  
  if (Object.keys(state.positions).length === 0) {
    console.log('No positions tracked.\n');
    console.log('Add with: trade-monitor.js add <stackId> <entryPrice>');
    return;
  }

  for (const [stackId, pos] of Object.entries(state.positions)) {
    const currentPrice = getStackPrice(stackId);
    const changePct = currentPrice ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : null;
    
    console.log(`Stack ${stackId}:`);
    console.log(`  Entry: $${pos.entryPrice.toFixed(4)}`);
    if (currentPrice) {
      console.log(`  Current: $${currentPrice.toFixed(4)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);
    }
    console.log(`  Peak: $${(pos.peakPrice || pos.entryPrice).toFixed(4)}`);
    console.log(`  TP stages hit: ${pos.takeProfitStages?.length || 0}`);
    console.log('');
  }

  console.log('📋 SCENARIOS:');
  console.log(`  Take Profit: ${config.scenarios.takeProfit.map(t => `+${t.triggerPct}%`).join(' → ')}`);
  console.log(`  Stop Loss: ${config.scenarios.stopLoss.triggerPct}%`);
  console.log(`  Trailing: ${config.scenarios.trailingStop.trailPct}% trail after +${config.scenarios.trailingStop.activateAtPct}%`);
}

function runOnce() {
  const config = loadConfig();
  const state = loadState();
  
  if (!config.enabled) {
    console.log('Monitor disabled in config');
    return;
  }

  console.log(`\n🔄 Checking positions at ${new Date().toISOString()}\n`);
  
  for (const [stackId, position] of Object.entries(state.positions)) {
    checkPosition(stackId, position, config, state);
  }
  
  state.lastCheck = Date.now();
  saveState(state);
}

// CLI
const cmd = process.argv[2];

switch (cmd) {
  case 'add':
    const stackId = process.argv[3];
    const entryPrice = parseFloat(process.argv[4]);
    if (!stackId || !entryPrice) {
      console.log('Usage: trade-monitor.js add <stackId> <entryPrice>');
      process.exit(1);
    }
    addPosition(stackId, entryPrice);
    break;
    
  case 'remove':
    const removeId = process.argv[3];
    if (!removeId) {
      console.log('Usage: trade-monitor.js remove <stackId>');
      process.exit(1);
    }
    const st = loadState();
    delete st.positions[removeId];
    saveState(st);
    console.log(`Removed position ${removeId}`);
    break;
    
  case 'list':
    listPositions();
    break;
    
  case 'check':
    runOnce();
    break;
    
  case 'config':
    const cfg = loadConfig();
    console.log(JSON.stringify(cfg, null, 2));
    break;
    
  case 'init':
    saveConfig(DEFAULT_CONFIG);
    console.log('Config initialized at', CONFIG_PATH);
    break;

  case 'history':
    const s = loadState();
    console.log('\n📜 EXECUTED ORDERS:\n');
    for (const order of (s.executedOrders || []).slice(-10)) {
      console.log(`${new Date(order.timestamp).toISOString()} | ${order.type} | Stack ${order.stackId} | ${order.changePct?.toFixed(1)}% | Order: ${order.orderId}`);
    }
    break;
    
  default:
    console.log(`
Indexify Smart Trading Monitor

USAGE:
  trade-monitor.js add <stackId> <entryPrice>   Add position to monitor
  trade-monitor.js remove <stackId>             Remove position
  trade-monitor.js list                         Show positions & scenarios
  trade-monitor.js check                        Run one check cycle
  trade-monitor.js config                       Show current config
  trade-monitor.js init                         Initialize default config
  trade-monitor.js history                      Show executed orders

SCENARIOS (edit trade-config.json):
  Take Profit:  +15% (sell 25%) → +30% (25%) → +50% (25%) → +100% (25%)
  Stop Loss:    -20% (sell 100%)
  Trailing:     10% trail from peak after +20%
`);
}
