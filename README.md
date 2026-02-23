# Indexify Skill

Trade crypto ETFs (stacks) on Solana via the [Indexify](https://indexify.app) platform.

## What is Indexify?

Indexify is like Vanguard for crypto. Buy weighted baskets of tokens with one transaction:

- **Official stacks** - Curated portfolios (Pre-IPO Tech, Solana Meme Index, TriChain Leaders)
- **User stacks** - Anyone can create weighted token portfolios
- **Auto-rebalancing** - Platform handles token weights
- **Creator fees** - Stack creators earn 0-0.5% on trades

## Installation

```bash
git clone https://github.com/cgallic/indexify-skill.git
cd indexify-skill
```

## Setup

1. **Sign up** at [indexify.app?ref=yellowgentle99960](https://indexify.app?ref=yellowgentle99960) (referral link)
2. Get your API key from Settings → API Key

```bash
# Option 1: Environment variable
export INDEXIFY_API_KEY="ix_your_key_here"

# Option 2: Save to file
echo "ix_your_key" > ~/.secrets/indexify-api-key
```

## Quick Start

```bash
# Check your balance
node scripts/quick-trade.js status

# See official stacks (curated ETFs)
node scripts/quick-trade.js official

# Buy $10 of Solana Meme Index (stack 280)
node scripts/quick-trade.js buy 280 10

# Sell 50% of holdings
node scripts/quick-trade.js sell 280 50
```

## Scripts

| Script | Purpose |
|--------|---------|
| `indexify-api.js` | Full API client (module + CLI) |
| `indexify.sh` | Bash CLI wrapper |
| `quick-trade.js` | Simple trading commands |
| `trade-monitor.js` | Automated take-profit/stop-loss |

## Full API Usage

```bash
# Account
node scripts/indexify-api.js account fetch
node scripts/indexify-api.js account search "trader"

# Stack Discovery
node scripts/indexify-api.js stacks trending
node scripts/indexify-api.js stacks official
node scripts/indexify-api.js stacks fetch '{"slug":"solana-meme-index"}'

# Trading
node scripts/indexify-api.js trade balance
node scripts/indexify-api.js trade buy 280 10      # Buy $10
node scripts/indexify-api.js trade sell 280 50     # Sell 50%

# Orders & History
node scripts/indexify-api.js orders list
node scripts/indexify-api.js history list

# Portfolio
node scripts/indexify-api.js portfolio holdings
```

## Use as Module

```javascript
const api = require('./scripts/indexify-api.js');

// Get trending stacks
const stacks = await api.stacks.trending(10);

// Buy a stack
const order = await api.trade.buy(280, 10);

// Check balance
const balance = await api.trade.balance();
```

## Official Stacks (Recommended)

| ID | Name | Description |
|----|------|-------------|
| 13198 | Pre IPO Technology Portfolio | Tokenized private company exposure |
| 274 | TriChain Leaders | BTC, SOL, ETH basket |
| 280 | Solana Meme Index | Diversified meme basket (WIF, BONK, etc.) |

## Automated Trading

Set up take-profit and stop-loss automation:

```bash
# Copy example config
cp trade-config.example.json trade-config.json

# Add a position to monitor
node scripts/trade-monitor.js add 280 1.50  # Stack ID + entry price

# Check positions
node scripts/trade-monitor.js list

# Run check (or set up cron)
node scripts/trade-monitor.js check
```

Default rules in `trade-config.json`:
- Take profit: +10% → +20% → +35% → +50% (25% each)
- Stop loss: -15%
- Trailing stop: 8% from peak after +15%

## API Coverage

**✅ Working:**
- Account (profile, search users)
- Profile (twitter, telegram, discord, linkedin, personal links)
- Stacks (discover, trending, official, create, edit, close)
- Tokens (list - 3107 tokens)
- Trading (balance, buy, sell, rebalance, withdraw*, export key*)
- Orders (list, status, retry, partial handling)
- History (transactions, summaries)
- Portfolio (holdings, P&L)
- Notifications
- Referrals
- Fees

*Requires SMS 2FA verification code

**❌ Not available in API:**
- Social follow/unfollow
- Chat/messages

## Links

- **Indexify (referral):** https://indexify.app?ref=yellowgentle99960
- **API Docs:** https://indexify.finance
- **OpenClaw:** https://openclaw.ai
- **Skill Author:** @SnappedAI

## License

MIT
