import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    
    console.log("Checking balance for address:", smartAccountAddress);
    const balance = await mockUSDC.balanceOf(smartAccountAddress);
    const decimals = await mockUSDC.decimals();
    
    console.log("Raw balance:", balance.toString());
    console.log("Formatted balance:", ethers.formatUnits(balance, decimals), "mUSDC");
    console.log("Decimals:", decimals);
    
    // Check the limit (10000 mUSDC)
    const limit = 10000n * (10n ** BigInt(decimals));
    console.log("Limit:", ethers.formatUnits(limit, decimals), "mUSDC");
    console.log("Has enough tokens (>= limit):", balance >= limit);
    
    // Try to call faucetTo to see what happens
    console.log("\nTrying to call faucetTo...");
    try {
      // This will simulate the call without actually executing it
      await mockUSDC.faucetTo.staticCall(smartAccountAddress);
      console.log("faucetTo call would succeed");
    } catch (error: any) {
      console.log("faucetTo call would fail:", error.message);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);