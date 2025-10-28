# PredictionMarket Scripts Guide

Interactive scripts for the complete PredictionMarket workflow.

## 🚀 Quick Start

```bash
# 1. Deploy contracts
npm run deploy:sepolia

# 2. Create event
QUESTION="Will AI achieve AGI by 2025?" DURATION_DAYS="90" npm run create-event

# 3. Place bet
EVENT_ID="0" PREDICTION="yes" BET_AMOUNT="25" npm run place-bet

# 4. Query events
npm run query-events
```

## 📋 Available Scripts

### Main Commands
- `npm run deploy:sepolia` - Deploy to Sepolia testnet
- `npm run deploy:localhost` - Deploy to localhost
- `npm run create-event` - Create prediction event
- `npm run place-bet` - Place bet on event
- `npm run query-events` - Query all events

### Development
- `npm run node` - Start local Hardhat network
- `npm run compile` - Compile contracts
- `npm run test` - Run tests

## Environment Variables

### create-event
- `QUESTION` - Prediction question (default: "Will Bitcoin reach $100,000 by the end of 2024?")
- `DURATION_DAYS` - Duration in days (default: 30)

### place-bet
- `EVENT_ID` - Event ID to bet on (default: 0)
- `PREDICTION` - "yes" or "no" (default: "yes")
- `BET_AMOUNT` - Amount in USDC (default: 10)

## Prerequisites

- Node.js and npm
- Hardhat environment
- For Sepolia: ETH for gas + configured `.env`
- USDC balance (auto-minted during deployment)

## Networks

Add `:localhost` suffix for local development:
- `npm run create-event:localhost`
- `npm run place-bet:localhost`
- `npm run query-events:localhost`