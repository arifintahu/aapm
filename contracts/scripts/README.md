# PredictionMarket Scripts Guide

This directory contains interactive scripts for the complete PredictionMarket workflow. Follow this guide to deploy, manage, and interact with prediction events in the correct order.

## 🚀 Complete Workflow

### Step 1: Deploy Contracts
First, deploy the PredictionMarket and MockUSDC contracts:

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# OR deploy to localhost (for development)
npm run deploy:localhost
```

### Step 2: Create Prediction Events
Create new prediction events on the deployed contract:

```bash
# Create event on Sepolia
QUESTION="Will AI achieve AGI by 2025?" DURATION_DAYS="90" npm run create-event

# Create event on localhost
QUESTION="Will AI achieve AGI by 2025?" DURATION_DAYS="90" npm run create-event:localhost
```

### Step 3: Place Bets
Place bets on existing prediction events:

```bash
# Place bet on Sepolia
EVENT_ID="0" PREDICTION="yes" BET_AMOUNT="25" npm run place-bet

# Place bet on localhost
EVENT_ID="0" PREDICTION="no" BET_AMOUNT="15" npm run place-bet:localhost
```

### Step 4: Query Events & Monitor
Query and monitor all events and their current state:

```bash
# Query events on Sepolia
npm run query-events

# Query events on localhost
npm run query-events:localhost
```

## 📋 Scripts Overview

### 1. deploy.ts
Deploys PredictionMarket and MockUSDC contracts to the specified network.

### 2. create-event.ts
Creates new prediction events on the deployed PredictionMarket contract.

### 3. place-bet.ts
Places bets on existing prediction events.

### 4. query-events.ts
Queries and displays all events, their details, and event logs.

## Prerequisites

- Node.js and npm installed
- Hardhat development environment set up
- For Sepolia: ETH for gas fees and configured wallet in `.env`
- For betting: Sufficient USDC balance (automatically minted during deployment)

## 🔧 Available NPM Scripts

### Deployment
- `npm run deploy` - Deploy to default network
- `npm run deploy:localhost` - Deploy to local Hardhat network
- `npm run deploy:sepolia` - Deploy to Sepolia testnet

### Event Management
- `npm run create-event` - Create event on Sepolia
- `npm run create-event:localhost` - Create event on localhost

### Betting
- `npm run place-bet` - Place bet on Sepolia
- `npm run place-bet:localhost` - Place bet on localhost

### Monitoring
- `npm run query-events` - Query events on Sepolia
- `npm run query-events:localhost` - Query events on localhost

### Development
- `npm run node` - Start local Hardhat network
- `npm run compile` - Compile contracts
- `npm run test` - Run tests
- `npm run clean` - Clean artifacts

## 📖 Detailed Usage

### 1. Deploying Contracts

```bash
# Start local network (for development)
npm run node

# Deploy contracts
npm run deploy:sepolia  # or deploy:localhost
```

**What happens:**
- Deploys MockUSDC contract
- Deploys PredictionMarket contract
- Mints initial USDC to deployer
- Saves deployment info to `deployments/latest.json`

### 2. Creating Events

```bash
# Using environment variables
QUESTION="Will AI achieve AGI by 2025?" DURATION_DAYS="90" npm run create-event
```

**Environment Variables:**
- `QUESTION`: The prediction question (default: "Will Bitcoin reach $100,000 by the end of 2024?")
- `DURATION_DAYS`: Duration in days (default: 30)

**What happens:**
- Validates owner permissions
- Creates new prediction event
- Returns new event ID and details

### 3. Placing Bets

```bash
# Using environment variables
EVENT_ID="0" PREDICTION="yes" BET_AMOUNT="25" npm run place-bet
```

**Environment Variables:**
- `EVENT_ID`: The event ID to bet on (default: 0)
- `PREDICTION`: "yes" or "no" (default: "yes")
- `BET_AMOUNT`: Amount in USDC (default: 10)

**What happens:**
- Validates event exists and is active
- Checks USDC balance and approves spending
- Places bet and updates event statistics
- Calculates potential winnings

### 4. Querying Events

```bash
# Query all events and logs
npm run query-events
```

**What happens:**
- Displays all created events with details
- Shows current betting statistics
- Lists recent event logs (EventCreated, BetPlaced, etc.)

## 🎯 Quick Start Example

Here's a complete workflow example:

```bash
# 1. Deploy contracts
npm run deploy:sepolia

# 2. Create a prediction event
QUESTION="Will Bitcoin reach $100,000 by end of 2024?" DURATION_DAYS="60" npm run create-event

# 3. Place a bet on the event
EVENT_ID="0" PREDICTION="yes" BET_AMOUNT="50" npm run place-bet

# 4. Check current status
npm run query-events
```

## 📊 Example Outputs

### Deploy Output
```
Deploying contracts to sepolia...
Deployer: 0x390DC2368bFDe7e7a370AF46C0B834B718D570C1
Deploying MockUSDC...
MockUSDC deployed to: 0xed3725F43893A72D8B940b6414eE10F4A570A769
Deploying PredictionMarket...
PredictionMarket deployed to: 0x24fFEAc69FE7CAcb45c7a39D0995618428205a6F
✅ Deployment completed successfully!
```
### Create Event Output
```
Creating a new prediction event...
Network: sepolia
PredictionMarket Address: 0x24fFEAc69FE7CAcb45c7a39D0995618428205a6F
Deployer/Owner: 0x390DC2368bFDe7e7a370AF46C0B834B718D570C1
---
Event Details:
Question: Will AI achieve AGI by 2025?
Duration: 90 days (7776000 seconds)
End Time: 1/26/2026, 5:31:12 PM
---
✅ Event created successfully! Block: 9507941
📊 New Event ID: 1
⛽ Gas used: 86685
```

### Place Bet Output
```
Placing a bet on a prediction event...
Placing bet on event 0
Prediction: no
Amount: 20 USDC
---
📊 Event Details:
  Question: Will Bitcoin reach $100,000 by the end of 2024?
  End Time: 11/4/2025, 9:51:48 AM
  Status: Active

💰 Your USDC Balance: 1009960.0 USDC
🔓 Approving USDC spending...
✅ USDC spending approved!
🎲 Placing bet...
✅ Bet placed successfully! Block: 9507961

📈 Updated Event Stats:
  Total Yes Bets: 0.0 USDC
  Total No Bets: 20.0 USDC
  Total Pool: 20.0 USDC
  Total Bets: 1

💎 Your Potential Winnings: 39.6 USDC
⛽ Gas used: 198067
```
### Query Events Output
```
Querying PredictionMarket events...
Network: sepolia
PredictionMarket Address: 0x24fFEAc69FE7CAcb45c7a39D0995618428205a6F

📊 Found 2 events:

Event 0:
  Question: Will Bitcoin reach $100,000 by the end of 2024?
  End Time: 11/4/2025, 9:51:48 AM
  Status: Active
  Yes Bets: 0.0 USDC | No Bets: 20.0 USDC
  Total Pool: 20.0 USDC | Total Bets: 1

Event 1:
  Question: Will AI achieve AGI by 2025?
  End Time: 1/26/2026, 5:31:12 PM
  Status: Active
  Yes Bets: 25.0 USDC | No Bets: 15.0 USDC
  Total Pool: 40.0 USDC | Total Bets: 2

📋 Recent Event Logs (1 found):
EventCreated - Block: 9507941
  Event ID: 1
  Question: Will AI achieve AGI by 2025?
  End Time: 1/26/2026, 5:31:12 PM
```

## ✨ Features Summary

### Complete Workflow Support
- ✅ **Deploy**: Full contract deployment with USDC minting
- ✅ **Create**: Event creation with owner validation
- ✅ **Bet**: Comprehensive betting with balance checks and approvals
- ✅ **Monitor**: Real-time event querying and log analysis

### Multi-Network Support
- ✅ **Sepolia Testnet**: Production-like testing environment
- ✅ **Localhost**: Local development and testing

### Error Handling & Validation
- ✅ Event existence and status validation
- ✅ Balance and allowance checks
- ✅ Time-based event expiration
- ✅ Owner permission validation
- ✅ Comprehensive error messages

### User Experience
- ✅ Environment variable configuration
- ✅ Detailed transaction feedback
- ✅ Gas usage reporting
- ✅ Potential winnings calculation
- ✅ Real-time event statistics

## 🌐 Networks

Both **Sepolia testnet** and **localhost** are fully supported. Use the appropriate npm script suffix (`:localhost`) for local development and testing.

**Sepolia Benefits:**
- Real network conditions
- Persistent state
- Shareable results

**Localhost Benefits:**
- Fast execution
- No gas costs
- Complete control