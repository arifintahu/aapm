import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Placing a bet on a prediction event...");
  
  // Read deployment information
  const deploymentsPath = path.join(__dirname, "..", "deployments", "latest.json");
  
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("Deployment file not found. Please deploy contracts first.");
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const predictionMarketAddress = deploymentData.contracts.PredictionMarket;
  const mockUSDCAddress = deploymentData.contracts.MockUSDC;
  
  console.log("Network:", deploymentData.network);
  console.log("PredictionMarket Address:", predictionMarketAddress);
  console.log("MockUSDC Address:", mockUSDCAddress);
  
  // Get the signer account
  const [signer] = await ethers.getSigners();
  console.log("Bettor:", signer.address);
  
  // Get contract instances
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = PredictionMarket.attach(predictionMarketAddress);
  
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(mockUSDCAddress);
  
  // Get parameters from environment variables or use defaults
  const eventId = parseInt(process.env.EVENT_ID || "0");
  const prediction = (process.env.PREDICTION || "yes").toLowerCase();
  const betAmountUSDC = parseFloat(process.env.BET_AMOUNT || "10");
  
  console.log(`Placing bet on event ${eventId}`);
  console.log(`Prediction: ${prediction}`);
  console.log(`Amount: ${betAmountUSDC} USDC`);
  
  // Validate prediction
  if (prediction !== "yes" && prediction !== "no") {
    throw new Error("Prediction must be 'yes' or 'no'");
  }
  
  const predictionEnum = prediction === "yes" ? 1 : 2; // Outcome.Yes = 1, Outcome.No = 2
  const betAmount = ethers.parseUnits(betAmountUSDC.toString(), 6); // USDC has 6 decimals
  
  console.log("---");
  console.log("Bet Details:");
  console.log(`Event ID: ${eventId}`);
  console.log(`Prediction: ${prediction.toUpperCase()}`);
  console.log(`Bet Amount: ${betAmountUSDC} USDC`);
  console.log("---");
  
  try {
    // Check if event exists and get event details
    const eventCounter = await predictionMarket.eventCounter();
    if (eventId >= Number(eventCounter)) {
      throw new Error(`Event ${eventId} does not exist. Total events: ${eventCounter}`);
    }
    
    // Get event details
    const eventData = await predictionMarket.events(eventId);
    console.log("📊 Event Details:");
    console.log(`  Question: ${eventData.question}`);
    console.log(`  End Time: ${new Date(Number(eventData.endTime) * 1000).toLocaleString()}`);
    console.log(`  Status: ${Number(eventData.status) === 0 ? 'Active' : 'Resolved'}`);
    console.log(`  Current Yes Bets: ${ethers.formatUnits(eventData.totalYesBets, 6)} USDC`);
    console.log(`  Current No Bets: ${ethers.formatUnits(eventData.totalNoBets, 6)} USDC`);
    console.log(`  Total Pool: ${ethers.formatUnits(eventData.totalPool, 6)} USDC`);
    
    // Check if event is active
    if (Number(eventData.status) !== 0) {
      throw new Error("Event is not active");
    }
    
    // Check if event has ended
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= Number(eventData.endTime)) {
      throw new Error("Event has already ended");
    }
    
    // Check USDC balance
    const usdcBalance = await mockUSDC.balanceOf(signer.address);
    console.log(`\\n💰 Your USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    
    if (usdcBalance < betAmount) {
      throw new Error(`Insufficient USDC balance. Required: ${betAmountUSDC} USDC, Available: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    }
    
    // Check and set allowance
    const currentAllowance = await mockUSDC.allowance(signer.address, predictionMarketAddress);
    console.log(`Current Allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);
    
    if (currentAllowance < betAmount) {
      console.log("\\n🔓 Approving USDC spending...");
      const approveTx = await mockUSDC.approve(predictionMarketAddress, betAmount);
      console.log(`Approval transaction hash: ${approveTx.hash}`);
      await approveTx.wait();
      console.log("✅ USDC spending approved!");
    }
    
    // Get bet count before placing bet
    const betCountBefore = await predictionMarket.getEventBetCount(eventId);
    console.log(`\\nCurrent bets on this event: ${betCountBefore}`);
    
    // Place the bet
    console.log("\\n🎲 Placing bet...");
    const tx = await predictionMarket.placeBet(eventId, predictionEnum, betAmount);
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Bet placed successfully! Block: ${receipt.blockNumber}`);
    
    // Get updated event data
    const updatedEventData = await predictionMarket.events(eventId);
    const betCountAfter = await predictionMarket.getEventBetCount(eventId);
    
    console.log("\\n📈 Updated Event Stats:");
    console.log(`  Total Yes Bets: ${ethers.formatUnits(updatedEventData.totalYesBets, 6)} USDC`);
    console.log(`  Total No Bets: ${ethers.formatUnits(updatedEventData.totalNoBets, 6)} USDC`);
    console.log(`  Total Pool: ${ethers.formatUnits(updatedEventData.totalPool, 6)} USDC`);
    console.log(`  Total Bets: ${betCountAfter}`);
    
    // Calculate potential winnings
  const outcome = prediction === "yes" ? 2 : 1; // Outcome.Yes = 2, Outcome.No = 1
  const potentialWinnings = await predictionMarket.calculatePotentialWinnings(
    eventId, 
    outcome, 
    betAmount
  );
    console.log(`\\n💎 Your Potential Winnings: ${ethers.formatUnits(potentialWinnings, 6)} USDC`);
    
    // Gas usage
    console.log(`\\n⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Show updated balance
    const newUsdcBalance = await mockUSDC.balanceOf(signer.address);
    console.log(`💰 Your New USDC Balance: ${ethers.formatUnits(newUsdcBalance, 6)} USDC`);
    
  } catch (error) {
    console.error("❌ Error placing bet:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Usage examples in comments
/*
Usage:
npm run place-bet                    # Bet 10 USDC on "yes" for event 0
npm run place-bet 0 yes 25          # Bet 25 USDC on "yes" for event 0
npm run place-bet 1 no 50           # Bet 50 USDC on "no" for event 1
npm run place-bet 0 yes 100         # Bet 100 USDC on "yes" for event 0

Parameters:
1. Event ID (number) - The event to bet on
2. Prediction (string) - "yes" or "no"
3. Amount (number) - Amount in USDC to bet
*/

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});