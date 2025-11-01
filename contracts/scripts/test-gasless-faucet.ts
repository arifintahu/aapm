import hre from "hardhat";
import { ethers } from "ethers";

const { ethers: hreEthers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    console.log("=== TESTING GASLESS FAUCET INTEGRATION ===");
    
    const [signer] = await hreEthers.getSigners();
    console.log("Signer address:", signer.address);
    
    const mockUSDC = await hreEthers.getContractAt("MockUSDC", mockUSDCAddress);
    
    // Check current balance
    console.log("\n=== BEFORE GASLESS FAUCET ===");
    const balanceBefore = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Smart account balance:", hreEthers.formatUnits(balanceBefore, 6), "mUSDC");
    
    // Test the exact same transaction data that the frontend would create
    console.log("\n=== SIMULATING FRONTEND GASLESS TRANSACTION ===");
    
    // Create the same interface and transaction data as the frontend
    const mockUSDCInterface = new hreEthers.Interface([
      "function faucetTo(address to)"
    ]);
    
    const txData = mockUSDCInterface.encodeFunctionData("faucetTo", [smartAccountAddress]);
    console.log("Transaction data:", txData);
    
    // This simulates what the gasless service would do
    const tx = await signer.sendTransaction({
      to: mockUSDCAddress,
      data: txData,
      value: 0
    });
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed");
    
    // Check balance after
    console.log("\n=== AFTER GASLESS FAUCET ===");
    const balanceAfter = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Smart account balance:", hreEthers.formatUnits(balanceAfter, 6), "mUSDC");
    
    const difference = balanceAfter - balanceBefore;
    console.log("Tokens received:", hreEthers.formatUnits(difference, 6), "mUSDC");
    
    if (difference === 1000000000n) { // 1000 * 10^6
      console.log("✅ Gasless faucet integration test PASSED!");
    } else {
      console.log("❌ Gasless faucet integration test FAILED!");
    }
    
  } catch (error: any) {
    console.error("❌ Gasless faucet test failed:", error.message);
    
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
  }
}

main().catch(console.error);