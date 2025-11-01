import hre from "hardhat";
import { ethers } from "ethers";

const { ethers: hreEthers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    // Simulate what the frontend does
    console.log("=== SIMULATING FRONTEND FAUCET CALL ===");
    
    // Get the signer (this simulates the Web3Auth provider)
    const [signer] = await hreEthers.getSigners();
    console.log("Signer address:", signer.address);
    
    // Create contract instance (this simulates the frontend contract service)
    const mockUSDC = await hreEthers.getContractAt("MockUSDC", mockUSDCAddress);
    
    // Check balances before
    console.log("\n=== BEFORE ===");
    const smartAccountBalance = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Smart account balance:", hreEthers.formatUnits(smartAccountBalance, 6), "mUSDC");
    
    // Simulate the frontend call with the same parameters
    console.log("\n=== CALLING FAUCET TO (Frontend simulation) ===");
    console.log("Target address:", smartAccountAddress);
    
    // This is exactly what the frontend does
    const tx = await mockUSDC.faucetTo(smartAccountAddress);
    console.log("Transaction hash:", tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);
    
    // Check balances after
    console.log("\n=== AFTER ===");
    const smartAccountBalanceAfter = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Smart account balance:", hreEthers.formatUnits(smartAccountBalanceAfter, 6), "mUSDC");
    
    console.log("\n✅ Frontend simulation successful!");
    
  } catch (error: any) {
    console.error("❌ Frontend simulation failed:", error.message);
    
    // Try to get more error details
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
    if (error.code) {
      console.log("Error code:", error.code);
    }
    
    // Check if it's a revert error
    if (error.message.includes("revert")) {
      console.log("This is a contract revert error");
    }
  }
}

main().catch(console.error);