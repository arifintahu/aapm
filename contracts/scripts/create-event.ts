import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Creating a new prediction event...");
  
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
  
  // Get the deployer account (should be the owner)
  const [deployer] = await ethers.getSigners();
  console.log("Deployer/Owner:", deployer.address);
  
  // Get contract instance
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = PredictionMarket.attach(predictionMarketAddress);
  
  // Event parameters - you can modify these
  const question = process.env.QUESTION || "Will Bitcoin reach $100,000 by the end of 2025?";
  const durationInDays = parseInt(process.env.DURATION_DAYS || "30"); // Default 30 days
  const durationInSeconds = durationInDays * 24 * 60 * 60;
  
  console.log("---");
  console.log("Event Details:");
  console.log(`Question: ${question}`);
  console.log(`Duration: ${durationInDays} days (${durationInSeconds} seconds)`);
  console.log(`End Time: ${new Date(Date.now() + durationInSeconds * 1000).toLocaleString()}`);
  console.log("---");
  
  try {
    // Check if the deployer is the owner
    const owner = await predictionMarket.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error(`Only the owner can create events. Owner: ${owner}, Current account: ${deployer.address}`);
    }
    
    // Get current event count before creating
    const eventCountBefore = await predictionMarket.eventCounter();
    console.log(`Current event count: ${eventCountBefore}`);
    
    // Create the event
    console.log("Creating event...");
    const tx = await predictionMarket.createEvent(question, durationInSeconds);
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Event created successfully! Block: ${receipt.blockNumber}`);
    
    // Get the new event count
    const eventCountAfter = await predictionMarket.eventCounter();
    const newEventId = eventCountAfter - 1n;
    
    console.log(`📊 New Event ID: ${newEventId}`);
    
    // Fetch and display the created event
    const eventData = await predictionMarket.events(newEventId);
    console.log("\\n📋 Event Details:");
    console.log(`  Question: ${eventData.question}`);
    console.log(`  End Time: ${new Date(Number(eventData.endTime) * 1000).toLocaleString()}`);
    console.log(`  Status: ${Number(eventData.status) === 0 ? 'Active' : 'Resolved'}`);
    console.log(`  Total Pool: ${ethers.formatUnits(eventData.totalPool, 6)} USDC`);
    
    // Gas usage
    console.log(`\\n⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
  } catch (error) {
    console.error("❌ Error creating event:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Usage examples in comments
/*
Usage:
npm run create-event
npm run create-event "Will Bitcoin reach $100,000?" 60
npm run create-event "Will the next US election be in 2024?" 365

Parameters:
1. Question (string) - The prediction question
2. Duration in days (number) - How long the event should run
*/

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});