import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  
  try {
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    
    console.log("Checking balance for smart account:", smartAccountAddress);
    
    const balance = await mockUSDC.balanceOf(smartAccountAddress);
    const decimals = await mockUSDC.decimals();
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    console.log("Raw balance:", balance.toString());
    console.log("Formatted balance:", formattedBalance, "mUSDC");
    
    const limit = 10000; // 10,000 mUSDC limit
    console.log("Limit:", limit, "mUSDC");
    console.log("Has enough tokens (>= limit):", parseFloat(formattedBalance) >= limit);
    
    if (parseFloat(formattedBalance) >= limit) {
      console.log("❌ Smart account already has enough tokens, faucet will fail");
    } else {
      console.log("✅ Smart account can claim from faucet");
    }
    
  } catch (error) {
    console.error("Error checking balance:", error);
  }
}

main().catch(console.error);