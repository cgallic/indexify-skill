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

---

## Automated Exit System

The trade monitor executes take-profit, stop-loss, and trailing stops automatically.

### Trading Profiles

Choose a profile based on your strategy:

| Profile | TP Targets | Stop Loss | Trailing | Best For |
|---------|-----------|-----------|----------|----------|
| `etf` | +10→20→35→50% | -15% | 8% after +15% | Diversified index stacks |
| `meme` | +50→100→200→500% | -40% | 20% after +50% | High volatility memes |
| `moonbag` | +100% (50%), +500%, +1000% | -50% | 25% after +100% | High conviction plays |
| `scalp` | +3→5% | -3% | 2% after +3% | Quick flips |
| `swing` | +20→40→75% | -12% | 10% after +20% | Multi-day trends |
| `conservative` | +5→10% | -5% | 3% after +5% | Capital preservation |
| `trailing_only` | None | -20% | 15% after +10% | Let winners run |
| `dca_out` | 0→5→10→15→20% | -25% | None | Gradual exit |

### Profile Details

#### ETF / Index (default)
```
Take Profit: +10% (sell 25%) → +20% (25%) → +35% (25%) → +50% (25%)
Stop Loss:   -15% (sell 100%)
Trailing:    8% from peak after +15%
```
Best for: Pre-IPO Tech, TriChain Leaders, diversified baskets

#### Meme / High Volatility
```
Take Profit: +50% (sell 25%) → +100% (25%) → +200% (25%) → +500% (25%)
Stop Loss:   -40% (sell 100%)
Trailing:    20% from peak after +50%
```
Best for: Solana Meme Index, meme baskets, high-vol plays

#### Moonbag
```
Take Profit: +100% (sell 50%) → +500% (25%) → +1000% (12.5%)
Stop Loss:   -50% (sell 100%)
Trailing:    25% from peak after +100%
```
Best for: High conviction, asymmetric bets. Recover principal at 2x, let rest ride.

#### Scalp
```
Take Profit: +3% (sell 50%) → +5% (50%)
Stop Loss:   -3% (sell 100%)
Trailing:    2% from peak after +3%
```
Best for: Range-bound markets, quick flips, high liquidity

#### Swing
```
Take Profit: +20% (sell 33%) → +40% (33%) → +75% (34%)
Stop Loss:   -12% (sell 100%)
Trailing:    10% from peak after +20%
```
Best for: Trending markets, breakouts, 1-2 week holds

#### Conservative
```
Take Profit: +5% (sell 50%) → +10% (50%)
Stop Loss:   -5% (sell 100%)
Trailing:    3% from peak after +5%
```
Best for: Capital preservation, small accounts, uncertain markets

#### Trailing Only
```
Take Profit: None
Stop Loss:   -20% (sell 100%)
Trailing:    15% from peak after +10%
```
Best for: Strong trends, momentum. No ceiling on gains.

#### DCA Out
```
Take Profit: 0% (20%) → +5% (20%) → +10% (20%) → +15% (20%) → +20% (20%)
Stop Loss:   -25% (sell 100%)
Trailing:    None
```
Best for: Reducing exposure gradually, uncertain direction

### Usage

```bash
# Add position with default profile (etf)
node scripts/trade-monitor.js add 280 1.50

# Add position with specific profile
node scripts/trade-monitor.js add 280 1.50 --profile meme

# List all profiles
node scripts/trade-monitor.js profiles

# See active positions
node scripts/trade-monitor.js list

# Run exit check (cron this every 1-5 min)
node scripts/trade-monitor.js check

# View trade history
node scripts/trade-monitor.js history

# Set default profile
node scripts/trade-monitor.js set-default meme

# Remove position
node scripts/trade-monitor.js remove 280
```

### How It Works

1. **Entry**: You add a position with `add <stackId> <entryPrice> --profile <name>`
2. **Monitor**: Cron runs `check` every 1-5 minutes
3. **Exit Logic** (in order):
   - **Stop Loss**: If price drops to trigger, sell 100% immediately
   - **Trailing Stop**: After reaching activation threshold, tracks peak price. Sells if drops X% from peak
   - **Take Profit Ladder**: At each target, sells configured percentage

### Example: Meme Trade

```bash
# Buy $20 of Solana Meme Index
node scripts/quick-trade.js buy 280 20

# Add to monitor with meme profile (entry price $1.50)
node scripts/trade-monitor.js add 280 1.50 --profile meme

# What happens:
# - At +50% ($2.25): Sells 25%
# - At +100% ($3.00): Sells 25%
# - At +200% ($4.50): Sells 25%
# - At +500% ($9.00): Sells final 25%
# - If drops to -40% ($0.90): Sells 100%
# - If hits +50% then drops 20% from any peak: Sells 100%
```

### Cron Setup

```bash
# Check every 5 minutes
*/5 * * * * cd /path/to/indexify-skill && node scripts/trade-monitor.js check >> /var/log/trade-monitor.log 2>&1
```

---

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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     INDEXIFY SKILL                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ quick-trade │  │ indexify.sh │  │   indexify-api.js   │ │
│  │   (simple)  │  │   (bash)    │  │   (full API)        │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              INDEXIFY API (api.indexify.finance)     │   │
│  │  • Account  • Stacks  • Trading  • Orders  • History │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   TRADE MONITOR                      │   │
│  │                                                      │   │
│  │  trade-config.json         trade-state.json         │   │
│  │  ┌─────────────────┐      ┌─────────────────┐       │   │
│  │  │ profiles:       │      │ positions:      │       │   │
│  │  │  • etf          │      │  stackId:       │       │   │
│  │  │  • meme         │      │    entryPrice   │       │   │
│  │  │  • moonbag      │      │    peakPrice    │       │   │
│  │  │  • scalp        │      │    profile      │       │   │
│  │  │  • swing        │      │    tpStages[]   │       │   │
│  │  │  • conservative │      │                 │       │   │
│  │  │  • trailing_only│      │ executedOrders[]│       │   │
│  │  │  • dca_out      │      │                 │       │   │
│  │  └─────────────────┘      └─────────────────┘       │   │
│  │                                                      │   │
│  │  trade-monitor.js check  (run via cron)             │   │
│  │    │                                                 │   │
│  │    ├─> Check stop loss (highest priority)           │   │
│  │    ├─> Check trailing stop                          │   │
│  │    └─> Check take profit ladder                     │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Links

- **Indexify (referral):** https://indexify.app?ref=yellowgentle99960
- **API Docs:** https://indexify.finance
- **OpenClaw:** https://openclaw.ai
- **Skill Author:** @SnappedAI

## License

MIT
