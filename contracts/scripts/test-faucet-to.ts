import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    
    // Check balances before
    console.log("\n=== BEFORE ===");
    const signerBalance = await mockUSDC.balanceOf(signer.address);
    const smartAccountBalance = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Signer balance:", ethers.formatUnits(signerBalance, 6), "mUSDC");
    console.log("Smart account balance:", ethers.formatUnits(smartAccountBalance, 6), "mUSDC");
    
    // Try to call faucetTo
    console.log("\n=== CALLING FAUCET TO ===");
    console.log("Calling faucetTo with target:", smartAccountAddress);
    
    const tx = await mockUSDC.faucetTo(smartAccountAddress);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);
    
    // Check balances after
    console.log("\n=== AFTER ===");
    const signerBalanceAfter = await mockUSDC.balanceOf(signer.address);
    const smartAccountBalanceAfter = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Signer balance:", ethers.formatUnits(signerBalanceAfter, 6), "mUSDC");
    console.log("Smart account balance:", ethers.formatUnits(smartAccountBalanceAfter, 6), "mUSDC");
    
    console.log("\n✅ faucetTo function works correctly!");
    
  } catch (error: any) {
    console.error("❌ Error calling faucetTo:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
  }
}

main().catch(console.error);