# Indexify Skill

Complete API integration for Indexify - crypto ETF platform on Solana.

## Overview

Indexify lets you trade weighted token portfolios (stacks) with one transaction. Think Vanguard ETFs for crypto.

**Platform:** https://indexify.app  
**API Base:** https://api.indexify.finance

## Setup

```bash
# Get API key from indexify.app → Settings → API Key
export INDEXIFY_API_KEY="ix_your_key_here"

# Or save to file
echo "ix_your_key" > ~/.secrets/indexify-api-key
```

## Scripts

| Script | Purpose |
|--------|---------|
| `indexify-api.js` | Full API client (module + CLI) |
| `indexify.sh` | Bash CLI wrapper |
| `quick-trade.js` | Simple trading commands |
| `trade-monitor.js` | Automated take-profit/stop-loss |

## Full API Reference

### Account

```bash
# Get your profile
node scripts/indexify-api.js account fetch

# Update profile
node scripts/indexify-api.js account update '{"bio":"Trader","slippage":"2"}'

# Check username availability
node scripts/indexify-api.js account checkName "myname"

# Search users
node scripts/indexify-api.js account search "trader"
```

### Stacks (Portfolios)

```bash
# Discovery
node scripts/indexify-api.js stacks trending           # Hot stacks
node scripts/indexify-api.js stacks official           # Curated ETFs
node scripts/indexify-api.js stacks list               # Paginated list

# Fetch specific stack
node scripts/indexify-api.js stacks fetch '{"id":280}'
node scripts/indexify-api.js stacks fetch '{"slug":"solana-meme-index"}'

# Related stacks by token
node scripts/indexify-api.js stacks related "So11111111111111111111111111111111111111112"

# Your stacks
node scripts/indexify-api.js stacks mine

# Stack analytics
node scripts/indexify-api.js stacks investors 280
node scripts/indexify-api.js stacks followers 280
node scripts/indexify-api.js stacks holdings 280
node scripts/indexify-api.js stacks versionHistory 280

# Validation
node scripts/indexify-api.js stacks checkName "My Stack"
node scripts/indexify-api.js stacks checkDescription "Description here"
```

### Tokens

```bash
# List tokens
node scripts/indexify-api.js tokens list

# Search tokens
node scripts/indexify-api.js tokens search "SOL"

# Get token by address
node scripts/indexify-api.js tokens fetch "So11111..."

# Get token categories
node scripts/indexify-api.js tokens categories
```

### Trading

```bash
# Check balances
node scripts/indexify-api.js trade balance        # All tokens
node scripts/indexify-api.js trade usdcBalance    # USDC only
node scripts/indexify-api.js trade totalBalance   # Total in USDC
node scripts/indexify-api.js trade address        # Wallet pubkey

# Execute trades
node scripts/indexify-api.js trade buy 280 10     # Buy $10 of stack 280
node scripts/indexify-api.js trade sell 280 50    # Sell 50% of stack 280
node scripts/indexify-api.js trade rebalance 280  # Rebalance to target
```

### Orders

```bash
# List orders
node scripts/indexify-api.js orders list

# Order details
node scripts/indexify-api.js orders details "order_abc123"
node scripts/indexify-api.js orders status "order_abc123"

# Handle partial orders
node scripts/indexify-api.js orders partialDetails "order_abc"
node scripts/indexify-api.js orders acknowledge "order_abc"
node scripts/indexify-api.js orders retry "order_abc"
node scripts/indexify-api.js orders retry "order_abc" 5     # With slippage
node scripts/indexify-api.js orders sellAll "order_abc"
```

### Transaction History

```bash
# List transactions
node scripts/indexify-api.js history list
node scripts/indexify-api.js history list '{"type":"buy","limit":10}'
node scripts/indexify-api.js history list '{"type":"sell"}'
node scripts/indexify-api.js history list '{"type":"deposit"}'
node scripts/indexify-api.js history list '{"status":"SUCCESS"}'

# Transaction detail
node scripts/indexify-api.js history detail "order_abc"

# Summary stats
node scripts/indexify-api.js history summary
```

### Fees

```bash
# Fee info
node scripts/indexify-api.js fees minBuy              # Min buy amount ($5)
node scripts/indexify-api.js fees creatorFeeBounds    # 0-0.5%
node scripts/indexify-api.js fees calculate 280 100   # Fee for $100 on stack 280
```

### Portfolio

```bash
# Your holdings with P&L
node scripts/indexify-api.js portfolio holdings
```

### Social

```bash
# Follow/unfollow stacks
node scripts/indexify-api.js social follow 280
node scripts/indexify-api.js social unfollow 280
node scripts/indexify-api.js social isFollowing 280
node scripts/indexify-api.js social following
```

### Chat

```bash
# Stack messages
node scripts/indexify-api.js chat messages 280
node scripts/indexify-api.js chat post 280 "Great returns!" "creator_notes"
```

### Notifications

```bash
node scripts/indexify-api.js notifications list
node scripts/indexify-api.js notifications unreadCount
node scripts/indexify-api.js notifications markRead 123
node scripts/indexify-api.js notifications markAllRead
```

### Referrals

```bash
node scripts/indexify-api.js referrals stats
node scripts/indexify-api.js referrals code
```

## Use as Module

```javascript
const api = require('./scripts/indexify-api.js');

// Async usage
const stacks = await api.stacks.trending(10);
const balance = await api.trade.balance();
const order = await api.trade.buy(280, 10);
```

## Official Stacks (Recommended)

| ID | Slug | Name | Description |
|----|------|------|-------------|
| 13198 | pre-ipo-technology-portfolio-cmkm | Pre IPO Tech | Tokenized private company exposure |
| 274 | trichain-leaders | TriChain Leaders | BTC, SOL, ETH basket |
| 280 | solana-meme-index | Solana Meme Index | Diversified meme basket |

## Trading Rules

1. **Use official stacks** for lower risk
2. **Buy on dips** - Check `change1D` before buying
3. **Position size** - Max 25% of balance per trade
4. **Set stops** - Use trade-monitor.js for automation
5. **Min buy** - $5 USDC minimum

## Automated Trading

```bash
# Add position to monitor
node scripts/trade-monitor.js add 280 1.50

# Check positions manually
node scripts/trade-monitor.js check

# View all positions
node scripts/trade-monitor.js list

# Edit config
cat trade-config.json
```

## Error Codes

| Error | Meaning |
|-------|---------|
| `Insufficient balance` | Not enough USDC |
| `Stack not found` | Invalid stack ID |
| `Unauthorized` | Bad/missing API key |
| `Invalid action` | Wrong action param |

## Stack Categories (Risk/Duration)

- `high_risk_short` - Volatile, short-term
- `high_risk_long` - Volatile, long-term hold
- `medium_risk_short` - Balanced, short-term
- `medium_risk_long` - Balanced, long-term
- `low_risk_short` - Conservative, short-term
- `low_risk_long` - Conservative, long-term
