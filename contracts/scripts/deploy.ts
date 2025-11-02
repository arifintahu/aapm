import hre from "hardhat";
import { Contract } from "ethers";

const { ethers } = hre;

async function main() {
  console.log("Starting deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy MockUSDC first
  console.log("\nDeploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", mockUSDCAddress);

  // Deploy PredictionMarket
  console.log("\nDeploying PredictionMarket...");
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy(mockUSDCAddress);
  await predictionMarket.waitForDeployment();
  const predictionMarketAddress = await predictionMarket.getAddress();
  console.log("PredictionMarket deployed to:", predictionMarketAddress);

  // Create a sample event
  console.log("\nCreating sample event...");
  const eventDuration = 7 * 24 * 60 * 60; // 7 days
  const createEventTx = await predictionMarket.createEvent(
    "Will Bitcoin reach $100,000 by the end of 2025?",
    eventDuration
  );
  await createEventTx.wait();
  console.log("Sample event created successfully");

  // Mint some tokens to deployer for testing
  console.log("\nMinting test tokens...");
  const mintAmount = ethers.parseUnits("10000", 6); // 10,000 mUSDC
  const mintTx = await mockUSDC.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("Minted 10,000 mUSDC to deployer");

  console.log("\n=== Deployment Summary ===");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("PredictionMarket:", predictionMarketAddress);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);

  // Save deployment addresses to a file
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(), // Convert BigInt to string
    deployer: deployer.address,
    contracts: {
      MockUSDC: mockUSDCAddress,
      PredictionMarket: predictionMarketAddress,
    },
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  const path = require("path");
  
  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Write deployment info
  const deploymentFile = path.join(deploymentsDir, `deployment-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", deploymentFile);

  // Also save latest deployment
  const latestFile = path.join(deploymentsDir, "latest.json");
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("Latest deployment info saved to:", latestFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });