#!/bin/bash
# Indexify CLI wrapper
set -e

API_BASE="https://api.indexify.finance"
API_KEY="${INDEXIFY_API_KEY:-$(cat ~/.secrets/indexify-api-key 2>/dev/null || cat ~/.indexify-key 2>/dev/null)}"

[[ -z "$API_KEY" ]] && { echo "Error: INDEXIFY_API_KEY not set" >&2; exit 1; }

api() {
  curl -s -X POST "${API_BASE}$1" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: ${API_KEY}" \
    -d "$2"
}

CMD="${1:-help}"; shift || true

case "$CMD" in
  account)
    case "${1:-fetch}" in
      fetch) api "/api/user_info.php?action=fetch" "{}" ;;
      update)
        shift; BIO="" SLIP=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --bio) BIO="$2"; shift 2;; --slippage) SLIP="$2"; shift 2;; *) shift;; esac
        done
        DATA="{}"
        [[ -n "$BIO" ]] && DATA=$(echo "$DATA" | jq --arg b "$BIO" '. + {bio: $b}')
        [[ -n "$SLIP" ]] && DATA=$(echo "$DATA" | jq --arg s "$SLIP" '. + {slippage: $s}')
        api "/api/user_info.php?action=update" "$DATA"
        ;;
    esac
    ;;

  notifications)
    case "${1:-list}" in
      list) api "/api/notifications.php?action=get_notifications" '{"page":1,"limit":20}' ;;
      unread) api "/api/notifications.php?action=get_unread_count" '{}' ;;
    esac
    ;;

  stacks)
    ACTION="${1:-trending}"; shift || true
    case "$ACTION" in
      trending)
        L=10 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/stack_info.php?action=trending" '{"limit":'"$L"',"offset":'"$O"'}'
        ;;
      list)
        L=20 O=0 S="change1D"
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; --sort) S="$2"; shift 2;; *) shift;; esac
        done
        api "/api/stack_info.php?action=paginated_list" '{"limit":'"$L"',"offset":'"$O"',"sort":"'"$S"'","order":"DESC"}'
        ;;
      fetch)
        SLUG="" ID=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --slug) SLUG="$2"; shift 2;; --id) ID="$2"; shift 2;; *) shift;; esac
        done
        [[ -n "$SLUG" ]] && api "/api/stack_info.php?action=fetch" '{"slugs":["'"$SLUG"'"]}' && exit
        [[ -n "$ID" ]] && api "/api/stack_info.php?action=fetch" '{"stackIds":['"$ID"']}' && exit
        echo "Error: --slug or --id required" >&2; exit 1
        ;;
      official)
        L=10 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/stack_info.php?action=official" '{"limit":'"$L"',"offset":'"$O"'}'
        ;;
      my)
        L=20 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/stack_info.php?action=my_stacks" '{"limit":'"$L"',"offset":'"$O"'}'
        ;;
      holdings)
        ID=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --id) ID="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$ID" ]] && { echo "Error: --id required" >&2; exit 1; }
        api "/api/stack_info.php?action=user_stack_holdings" '{"stack_id":'"$ID"'}'
        ;;
      *) echo "Unknown stacks action: $ACTION" >&2; exit 1 ;;
    esac
    ;;

  tokens)
    case "${1:-list}" in
      list)
        shift || true; L=50 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/token_info.php?action=paginated_list" '{"limit":'"$L"',"offset":'"$O"'}'
        ;;
    esac
    ;;

  portfolio)
    case "${1:-holdings}" in
      holdings) api "/api/portfolio.php?action=holdings" '{}' ;;
      history)
        shift || true; L=20 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/portfolio.php?action=history" '{"limit":'"$L"',"offset":'"$O"'}'
        ;;
    esac
    ;;

  trade)
    ACTION="${1:-balance}"; shift || true
    case "$ACTION" in
      balance) api "/api/txn.php?action=balance" '{}' ;;
      usdc) api "/api/txn.php?action=usdc_balance" '{}' ;;
      total) api "/api/txn.php?action=total_balance" '{}' ;;
      address) api "/api/txn.php?action=address" '{}' ;;
      buy)
        STACK="" AMT=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --stack) STACK="$2"; shift 2;; --amount) AMT="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$STACK" || -z "$AMT" ]] && { echo "Error: --stack and --amount required" >&2; exit 1; }
        api "/api/txn.php?action=swap" '{"stack_id":'"$STACK"',"amount":'"$AMT"',"cue":"fromUSDC"}'
        ;;
      sell)
        STACK="" PCT=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --stack) STACK="$2"; shift 2;; --percent) PCT="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$STACK" || -z "$PCT" ]] && { echo "Error: --stack and --percent required" >&2; exit 1; }
        api "/api/txn.php?action=swap" '{"stack_id":'"$STACK"',"amount":'"$PCT"',"cue":"toUSDC"}'
        ;;
      rebalance)
        STACK=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --stack) STACK="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$STACK" ]] && { echo "Error: --stack required" >&2; exit 1; }
        api "/api/txn.php?action=rebalance" '{"stack_id":'"$STACK"'}'
        ;;
      *) echo "Unknown trade action: $ACTION" >&2; exit 1 ;;
    esac
    ;;

  orders)
    ACTION="${1:-list}"; shift || true
    case "$ACTION" in
      list)
        L=20 O=0
        while [[ $# -gt 0 ]]; do
          case "$1" in --limit) L="$2"; shift 2;; --offset) O="$2"; shift 2;; *) shift;; esac
        done
        api "/api/user_orders.php?offset=$O&limit=$L" '{}'
        ;;
      details)
        ID=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --id) ID="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$ID" ]] && { echo "Error: --id required" >&2; exit 1; }
        api "/api/orders.php?action=details" '{"order_id":"'"$ID"'"}'
        ;;
      status)
        ID=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --id) ID="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$ID" ]] && { echo "Error: --id required" >&2; exit 1; }
        api "/api/orders.php?action=status" '{"order_id":"'"$ID"'"}'
        ;;
      retry)
        ID="" SLIP=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --id) ID="$2"; shift 2;; --slippage) SLIP="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$ID" ]] && { echo "Error: --id required" >&2; exit 1; }
        DATA='{"order_id":"'"$ID"'"}'
        [[ -n "$SLIP" ]] && DATA='{"order_id":"'"$ID"'","slippage":'"$SLIP"'}'
        api "/api/orders.php?action=retry" "$DATA"
        ;;
      *) echo "Unknown orders action: $ACTION" >&2; exit 1 ;;
    esac
    ;;

  history)
    L=20 O=0 TYPE="" STATUS="" STACK=""
    while [[ $# -gt 0 ]]; do
      case "$1" in 
        --limit) L="$2"; shift 2;; 
        --offset) O="$2"; shift 2;; 
        --type) TYPE="$2"; shift 2;;
        --status) STATUS="$2"; shift 2;;
        --stack) STACK="$2"; shift 2;;
        *) shift;; 
      esac
    done
    URL="/api/transaction_history.php?action=list&offset=$O&limit=$L"
    [[ -n "$TYPE" ]] && URL="$URL&type=$TYPE"
    [[ -n "$STATUS" ]] && URL="$URL&status=$STATUS"
    [[ -n "$STACK" ]] && URL="$URL&stack_id=$STACK"
    curl -s -X GET "${API_BASE}${URL}" -H "X-API-KEY: ${API_KEY}"
    ;;

  fees)
    ACTION="${1:-bounds}"; shift || true
    case "$ACTION" in
      bounds) api "/api/fee.php?action=creator_fee_bounds" '{}' ;;
      min) api "/api/fee.php?action=min_buy" '{}' ;;
      calc)
        STACK="" AMT=""
        while [[ $# -gt 0 ]]; do
          case "$1" in --stack) STACK="$2"; shift 2;; --amount) AMT="$2"; shift 2;; *) shift;; esac
        done
        [[ -z "$STACK" || -z "$AMT" ]] && { echo "Error: --stack and --amount required" >&2; exit 1; }
        api "/api/fee.php?action=calculate" '{"stack_id":'"$STACK"',"amount":'"$AMT"'}'
        ;;
      *) echo "Unknown fees action: $ACTION" >&2; exit 1 ;;
    esac
    ;;

  help|*)
    cat << 'EOF'
Indexify CLI - DeFi Portfolio Platform

USAGE: indexify.sh <command> [action] [options]

COMMANDS:
  account [fetch|update]           User profile
  notifications [list|unread]      Notifications  
  stacks [trending|list|fetch|official|my|holdings]
  tokens [list]                    Token database
  portfolio [holdings|history]     Your investments
  trade [balance|usdc|total|address|buy|sell|rebalance]
  orders [list|details|status|retry]
  history [--type buy|sell|deposit|withdrawal]
  fees [bounds|min|calc]

TRADING:
  trade balance                    All token balances
  trade usdc                       USDC balance only
  trade address                    Wallet public key
  trade buy --stack ID --amount USDC
  trade sell --stack ID --percent 1-100
  trade rebalance --stack ID

EXAMPLES:
  indexify.sh stacks trending --limit 5
  indexify.sh trade balance
  indexify.sh trade buy --stack 123 --amount 50
  indexify.sh orders list
EOF
    ;;
esac
