### Project: Gasless Prediction Market Betting with Account Abstraction

#### Why This?
- **Problem**: Prediction markets like Polymarket require users to manage complex wallets, pay gas fees, and bridge assets, which feels clunky and DeFi-heavy.
- **Opportunity**: ERC-4337 account abstraction allows gasless transactions, simplified wallet creation (e.g., no seed phrases), and bundled operations (e.g., approving and betting in one transaction), making the UX smoother.
- **Feasibility**: You can use existing ERC-4337 infrastructure (e.g., Biconomy or Stackup) and a testnet to build a prototype in a week.
- **Impact**: A gasless, intuitive interface could attract non-crypto users to prediction markets, aligning with the hackathon’s UX improvement theme.

#### Project Scope
- **Core Functionality**: Build a simple prediction market dApp where users can bet on a predefined event (e.g., “Will Ethereum’s price be above $3,000 on Nov 1, 2025?”) using a smart contract wallet powered by ERC-4337. Users connect via a browser wallet or social login, and transactions (e.g., betting) are gasless, sponsored by a paymaster.
- **Simplification**: Focus on one event, one token (e.g., USDC on a testnet), and a basic smart contract wallet setup.
- **Deliverable**: A demo dApp with a front-end where users bet without paying gas or managing seed phrases, showing the bet recorded on-chain.

#### Tech Stack
- **Account Abstraction**: Use Biconomy’s SDK or Stackup’s ERC-4337 tools for smart contract wallets and paymaster (gas sponsorship).
- **Blockchain**: Sepolia testnet for deploying contracts (free and fast).
- **Smart Contract**: Solidity contract for a simple prediction market (e.g., users bet “Yes” or “No” on an event).
- **Front-End**: Next.js or React for a clean UI with social login (e.g., Web3Auth for non-crypto users).
- **Token**: Use a testnet ERC-20 token (e.g., mock USDC) for betting.
- **Tools**: Hardhat for contract development, Ethers.js for blockchain interaction, Biconomy/Stackup for account abstraction.

#### Steps to Build (One Week Plan)
1. **Day 1: Define Scope and Setup**
   - Define one event (e.g., “ETH > $3,000 on Nov 1, 2025”).
   - Set up a Hardhat project for smart contracts and a Next.js app for the front-end.
   - Sign up for Biconomy or Stackup (Biconomy is beginner-friendly) and get API keys for their ERC-4337 bundler and paymaster.
   - Install dependencies: Ethers.js, Biconomy SDK (or Stackup), and Web3Auth for social login.

2. **Day 2: Smart Contract Development**
   - Write a Solidity contract for a simple prediction market:
     - Users can bet “Yes” or “No” with a testnet ERC-20 token.
     - Store bets and allow an admin (you) to resolve the outcome manually.
     - Include functions for depositing tokens and withdrawing winnings.
   - Deploy the contract and a mock USDC token to Sepolia.
   - Test locally with Hardhat to ensure betting works.

3. **Day 3: Account Abstraction Integration**
   - Use Biconomy’s SDK to:
     - Create a smart contract wallet for each user via ERC-4337.
     - Set up a paymaster to sponsor gas fees (Biconomy provides testnet paymasters).
     - Bundle transactions (e.g., approve token + place bet in one user action).
   - Test the smart wallet creation and gasless transaction flow on Sepolia.

4. **Day 4: Front-End Development**
   - Build a Next.js app with:
     - A Web3Auth login (e.g., Google login) to create/connect a smart wallet.
     - A simple UI showing the event question, “Yes”/“No” buttons, and a bet amount input.
     - A display showing the user’s bet and wallet balance.
   - Use Ethers.js and Biconomy SDK to send gasless transactions to the prediction market contract.

5. **Day 5: Integration and Testing**
   - Connect Web3Auth to Biconomy for wallet creation (Web3Auth integrates easily with ERC-4337).
   - Test the full flow: user logs in → smart wallet created → user bets gaslessly → bet recorded on-chain.
   - Test edge cases (e.g., insufficient token balance, paymaster limits).

6. **Day 6: Polish and Demo Prep**
   - Add basic error handling (e.g., “Insufficient funds” or “Transaction pending”).
   - Style the UI with Tailwind CSS for a clean, professional look.
   - Create a faucet to distribute testnet USDC to demo users (or pre-fund wallets).
   - Prepare a demo script showing a user logging in, betting, and seeing the result without gas fees.

7. **Day 7: Final Testing and Submission**
   - Run end-to-end tests on Sepolia (login, bet, view results).
   - Record a demo video showing the gasless betting flow.
   - Create a slide deck explaining the problem (complex UX), solution (account abstraction), and tech stack.
   - Submit to the hackathon platform.

#### Simplifications for One Week
- **Single Event**: Hardcode one prediction event to avoid complex market creation logic.
- **Mock Token**: Use a testnet ERC-20 token instead of bridging real assets.
- **Basic Paymaster**: Rely on Biconomy’s testnet paymaster for gas sponsorship (no custom paymaster logic).
- **Manual Resolution**: Skip oracle integration (e.g., UMA) and have an admin resolve the outcome manually.
- **Minimal UI**: One page with login, bet buttons, and a balance display.

#### Demo Deliverable
- A dApp where a user:
  - Logs in with Google via Web3Auth (no seed phrase).
  - Receives a smart contract wallet (ERC-4337).
  - Bets on “ETH > $3,000” with testnet USDC, gaslessly.
  - Sees their bet recorded on-chain and displayed in the UI.
- A video or live demo showing the flow, highlighting the gasless, non-crypto-native UX.

#### Why This Over Other Ideas?
- **AI Oracle**: Requires integrating AI models and data sources, which adds complexity compared to leveraging existing ERC-4337 tools.
- **Subjective Predictions**: Needs complex dispute logic, which is hard to prototype in a week.
- **Liquidity Pools**: AMM-style systems involve advanced DeFi mechanics, which are time-intensive.
- **Dispute Bots**: Requires monitoring and automation logic, which is challenging for a short timeline.

#### Resources
- **Biconomy SDK**: Simplifies ERC-4337 integration (https://docs.biconomy.io/).
- **Web3Auth**: For social login and wallet creation (https://web3auth.io/docs/).
- **Sepolia Testnet**: Use Alchemy or Infura for free testnet access.
- **Hardhat**: For contract development (https://hardhat.org/).
- **Sample ERC-20**: Use OpenZeppelin’s ERC-20 contract for mock USDC (https://docs.openzeppelin.com/contracts/4.x/erc20).
- **ERC-4337 Docs**: Learn the standard (https://eips.ethereum.org/EIPS/eip-4337).

#### Tips
- **Solo vs. Team**: If solo, focus on the Biconomy integration and a minimal UI. If with a team, split tasks (e.g., one on contracts, one on front-end, one on account abstraction).
- **Faucet**: Create a simple faucet for testnet USDC to make the demo smooth (or pre-fund wallets).
- **Debugging**: Testnet paymasters can have limits; monitor Biconomy’s dashboard for errors.

This project is achievable in a week, leverages existing account abstraction tools, and directly addresses the UX pain points of prediction markets. Let me know if you need code snippets (e.g., Solidity contract, Biconomy setup) or help with specific steps!