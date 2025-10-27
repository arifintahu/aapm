# AAPM - Gasless Prediction Market Betting Platform

A decentralized prediction market platform built with React, Express, and Ethereum smart contracts, featuring gasless transactions through Biconomy.

## Features

- **Gasless Transactions**: Users can interact with smart contracts without paying gas fees
- **Web3 Authentication**: Secure login using Web3Auth
- **Prediction Markets**: Create and participate in prediction markets
- **Real-time Updates**: Live market data and betting information
- **Responsive Design**: Modern UI built with React and Tailwind CSS

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Blockchain**: Ethereum, Hardhat, Ethers.js
- **Authentication**: Web3Auth
- **Gasless Transactions**: Biconomy
- **State Management**: Zustand

## Project Structure

This is a multi-project workspace containing three separate applications:

```
aapm/
├── contracts/             # Smart contracts (Hardhat project)
│   ├── contracts/         # Solidity smart contracts
│   ├── scripts/           # Deployment scripts
│   ├── test/              # Contract tests
│   ├── artifacts/         # Compiled contracts
│   ├── cache/             # Hardhat cache
│   ├── typechain-types/   # TypeScript contract types
│   ├── hardhat.config.ts  # Hardhat configuration
│   └── package.json       # Contract dependencies
├── backend/               # API server (Express.js)
│   ├── api/               # Express server and routes
│   ├── nodemon.json       # Nodemon configuration
│   └── package.json       # Backend dependencies
├── frontend/              # React application (Vite)
│   ├── src/               # React source code
│   ├── public/            # Static assets
│   ├── index.html         # HTML template
│   ├── vite.config.ts     # Vite configuration
│   ├── tailwind.config.js # Tailwind CSS config
│   └── package.json       # Frontend dependencies
├── .trae/                 # Documentation
└── package.json           # Workspace configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aapm
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables in each project:
   - Copy `.env.example` to `.env` in each project directory
   - Fill in the required environment variables

### Development

#### Option 1: Run all services together
```bash
npm run dev
```
This starts both backend and frontend servers concurrently.

#### Option 2: Run services individually

**Smart Contracts (Local Blockchain):**
```bash
npm run dev:contracts
```

**Backend API Server:**
```bash
npm run dev:backend
```

**Frontend Application:**
```bash
npm run dev:frontend
```

### Application URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Local Blockchain: http://localhost:8545

### Smart Contract Development

1. Navigate to contracts directory:
```bash
cd contracts
```

2. Compile contracts:
```bash
npm run compile
```

3. Run tests:
```bash
npm run test
```

4. Deploy to local network:
```bash
npm run node          # Start local blockchain
npm run deploy        # Deploy contracts
```

### Building for Production

Build all projects:
```bash
npm run build:all
```

Or build individually:
```bash
npm run build:contracts  # Compile smart contracts
npm run build:backend    # Build backend server
npm run build:frontend   # Build frontend application
```

### Environment Variables

Each project requires its own environment variables:

**Frontend (.env):**
- `VITE_WEB3AUTH_CLIENT_ID`: Your Web3Auth client ID
- `VITE_BICONOMY_API_KEY`: Your Biconomy API key
- `VITE_CONTRACT_ADDRESS`: Deployed contract address

**Backend (.env):**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

**Contracts (.env):**
- `PRIVATE_KEY`: Deployment wallet private key
- `INFURA_API_KEY`: Infura project API key (for testnet/mainnet)

## Available Scripts

### Workspace Level
- `npm run install:all` - Install dependencies for all projects
- `npm run dev` - Start backend and frontend in development mode
- `npm run build:all` - Build all projects for production
- `npm run clean` - Clean all build artifacts

### Individual Projects
- `npm run dev:contracts` - Start local Hardhat node
- `npm run dev:backend` - Start backend development server
- `npm run dev:frontend` - Start frontend development server
- `npm run test:contracts` - Run smart contract tests
- `npm run lint:frontend` - Lint frontend code

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
