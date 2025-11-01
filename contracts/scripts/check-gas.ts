import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    // Check signer balance
    const balance = await ethers.provider.getBalance(signer.address);
    console.log("Signer balance:", ethers.formatEther(balance), "BNB");
    
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    
    // Try to estimate gas for faucetTo
    console.log("\nEstimating gas for faucetTo...");
    try {
      const gasEstimate = await mockUSDC.faucetTo.estimateGas(smartAccountAddress);
      console.log("Gas estimate:", gasEstimate.toString());
      
      // Get current gas price
      const gasPrice = await ethers.provider.getFeeData();
      console.log("Gas price:", gasPrice.gasPrice?.toString());
      
      if (gasPrice.gasPrice) {
        const txCost = gasEstimate * gasPrice.gasPrice;
        console.log("Transaction cost:", ethers.formatEther(txCost), "BNB");
        
        // Check if signer has enough balance
        const hasEnoughBalance = balance > txCost;
        console.log("Has enough balance for tx:", hasEnoughBalance);
      }
      
    } catch (error: any) {
      console.log("Gas estimation failed:", error.message);
      
      // Try to get more details about the error
      if (error.data) {
        console.log("Error data:", error.data);
      }
      if (error.reason) {
        console.log("Error reason:", error.reason);
      }
    }
    
    // Try to call the regular faucet function for comparison
    console.log("\nTrying regular faucet function...");
    try {
      const gasEstimate = await mockUSDC.faucet.estimateGas();
      console.log("Regular faucet gas estimate:", gasEstimate.toString());
    } catch (error: any) {
      console.log("Regular faucet gas estimation failed:", error.message);
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);