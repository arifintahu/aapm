import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  
  // This is the wallet address from the error logs
  const walletAddress = "0x390dc2368bfde7e7a370af46c0b834b718d570c1";
  
  try {
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    
    console.log("Checking balance for wallet address:", walletAddress);
    const balance = await mockUSDC.balanceOf(walletAddress);
    const decimals = await mockUSDC.decimals();
    
    console.log("Raw balance:", balance.toString());
    console.log("Formatted balance:", ethers.formatUnits(balance, decimals), "mUSDC");
    
    // Check the limit (10000 mUSDC)
    const limit = 10000n * (10n ** BigInt(decimals));
    console.log("Limit:", ethers.formatUnits(limit, decimals), "mUSDC");
    console.log("Has enough tokens (>= limit):", balance >= limit);
    
    if (balance >= limit) {
      console.log("❌ Wallet already has enough tokens, regular faucet will fail");
    } else {
      console.log("✅ Wallet can use regular faucet");
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);