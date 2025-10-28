import hre from "hardhat";
import { Contract } from "ethers";
import * as fs from "fs";
import * as path from "path";

const { ethers } = hre;

async function main() {
  console.log("Querying events from PredictionMarket contract...");

  // Read deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "latest.json");
  
  if (!fs.existsSync(latestFile)) {
    console.error("No deployment found. Please deploy contracts first.");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const predictionMarketAddress = deploymentInfo.contracts.PredictionMarket;
  
  console.log("Network:", deploymentInfo.network);
  console.log("PredictionMarket Address:", predictionMarketAddress);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("---");

  // Get contract instance
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = PredictionMarket.attach(predictionMarketAddress) as Contract;

  try {
    // Get event counter to know how many events exist
    const eventCounter = await predictionMarket.eventCounter();
    console.log(`Total events created: ${eventCounter}`);
    console.log("---");

    if (eventCounter === 0n) {
      console.log("No events found.");
      return;
    }

    // Query all events
    for (let i = 0; i < eventCounter; i++) {
      console.log(`\n📊 Event #${i}:`);
      
      try {
        // Use the events mapping directly instead of getEvent function
        const eventData = await predictionMarket.events(i);
        
        console.log(`  Question: ${eventData.question}`);
        console.log(`  End Time: ${new Date(Number(eventData.endTime) * 1000).toLocaleString()}`);
        console.log(`  Status: ${Number(eventData.status) === 0 ? 'Active' : 'Resolved'}`);
        console.log(`  Result: ${Number(eventData.result) === 0 ? 'None' : Number(eventData.result) === 1 ? 'Yes' : 'No'}`);
        console.log(`  Total Yes Bets: ${ethers.formatUnits(eventData.totalYesBets, 6)} USDC`);
        console.log(`  Total No Bets: ${ethers.formatUnits(eventData.totalNoBets, 6)} USDC`);
        console.log(`  Total Pool: ${ethers.formatUnits(eventData.totalPool, 6)} USDC`);
        
        // Get bet count for this event
        const betCount = await predictionMarket.getEventBetCount(i);
        console.log(`  Total Bets: ${betCount.toString()}`);
        
        // Check if event has ended
        const currentTime = Math.floor(Date.now() / 1000);
        const hasEnded = currentTime >= Number(eventData.endTime);
        console.log(`  Has Ended: ${hasEnded}`);
        
      } catch (error) {
        console.log(`  Error fetching event ${i}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log("\n---");
    console.log("📈 Summary:");
    console.log(`Total Events: ${eventCounter}`);
    
    // Get contract balance
    const mockUSDCAddress = deploymentInfo.contracts.MockUSDC;
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = MockUSDC.attach(mockUSDCAddress) as Contract;
    
    const contractBalance = await mockUSDC.balanceOf(predictionMarketAddress);
    console.log(`Contract USDC Balance: ${ethers.formatUnits(contractBalance, 6)} USDC`);

  } catch (error) {
    console.error("Error querying events:", error);
  }
}

// Helper function to get event logs (optional)
async function getEventLogs() {
  console.log("\n🔍 Fetching event logs...");
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "latest.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const predictionMarketAddress = deploymentInfo.contracts.PredictionMarket;
  
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = PredictionMarket.attach(predictionMarketAddress) as Contract;

  try {
    // Get the current block number
    const provider = ethers.provider;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Limit to last 10,000 blocks
    
    console.log(`Fetching logs from block ${fromBlock} to ${currentBlock}...`);
    
    // Get EventCreated logs
    const eventCreatedFilter = predictionMarket.filters.EventCreated();
    const eventCreatedLogs = await predictionMarket.queryFilter(eventCreatedFilter, fromBlock, currentBlock);
    
    console.log(`\n📝 EventCreated logs (${eventCreatedLogs.length}):`);
    for (const log of eventCreatedLogs) {
      const args = (log as any).args;
      console.log(`  Event ID: ${args.eventSWSId.toString()}`);
      console.log(`  Question: ${args.question}`);
      console.log(`  End Time: ${new Date(Number(args.endTime) * 1000).toLocaleString()}`);
      console.log(`  Creator: ${args.creator}`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  ---`);
    }
    
    // Get BetPlaced logs
    const betPlacedFilter = predictionMarket.filters.BetPlaced();
    const betPlacedLogs = await predictionMarket.queryFilter(betPlacedFilter, fromBlock, currentBlock);
    
    console.log(`\n💰 BetPlaced logs (${betPlacedLogs.length}):`);
    for (const log of betPlacedLogs) {
      const args = (log as any).args;
      console.log(`  Event ID: ${args.eventId.toString()}`);
      console.log(`  Bettor: ${args.bettor}`);
      console.log(`  Prediction: ${Number(args.prediction) === 1 ? 'Yes' : 'No'}`);
      console.log(`  Amount: ${ethers.formatUnits(args.amount.toString(), 6)} USDC`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  ---`);
    }
    
    // Get EventResolved logs
    const eventResolvedFilter = predictionMarket.filters.EventResolved();
    const eventResolvedLogs = await predictionMarket.queryFilter(eventResolvedFilter, fromBlock, currentBlock);
    
    console.log(`\n✅ EventResolved logs (${eventResolvedLogs.length}):`);
    for (const log of eventResolvedLogs) {
      const args = (log as any).args;
      console.log(`  Event ID: ${args.eventId.toString()}`);
      console.log(`  Result: ${Number(args.result) === 1 ? 'Yes' : 'No'}`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  ---`);
    }
    
  } catch (error) {
    console.log("Error fetching event logs:", error instanceof Error ? error.message : String(error));
  }
}

main()
  .then(() => getEventLogs())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });