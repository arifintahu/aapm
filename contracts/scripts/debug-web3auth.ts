import hre from "hardhat";
import { ethers } from "ethers";

const { ethers: hreEthers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb";
  
  try {
    console.log("=== DEBUGGING WEB3AUTH TRANSACTION ISSUE ===");
    
    const [signer] = await hreEthers.getSigners();
    console.log("Signer address:", signer.address);
    console.log("Signer balance:", hreEthers.formatEther(await signer.provider.getBalance(signer.address)), "BNB");
    
    const mockUSDC = await hreEthers.getContractAt("MockUSDC", mockUSDCAddress);
    
    // Check current balances
    console.log("\n=== CURRENT BALANCES ===");
    const smartAccountBalance = await mockUSDC.balanceOf(smartAccountAddress);
    const signerBalance = await mockUSDC.balanceOf(signer.address);
    console.log("Smart account balance:", hreEthers.formatUnits(smartAccountBalance, 6), "mUSDC");
    console.log("Signer balance:", hreEthers.formatUnits(signerBalance, 6), "mUSDC");
    
    // Test gas estimation (this is what might be failing in Web3Auth)
    console.log("\n=== GAS ESTIMATION TEST ===");
    try {
      const gasEstimate = await mockUSDC.faucetTo.estimateGas(smartAccountAddress);
      console.log("✅ Gas estimation successful:", gasEstimate.toString());
      
      // Calculate gas cost
      const gasPrice = await signer.provider.getFeeData();
      console.log("Gas price:", gasPrice.gasPrice?.toString());
      
      if (gasPrice.gasPrice) {
        const gasCost = gasEstimate * gasPrice.gasPrice;
        console.log("Estimated gas cost:", hreEthers.formatEther(gasCost), "BNB");
      }
      
    } catch (gasError: any) {
      console.error("❌ Gas estimation failed:", gasError.message);
      return;
    }
    
    // Test static call (this should work)
    console.log("\n=== STATIC CALL TEST ===");
    try {
      await mockUSDC.faucetTo.staticCall(smartAccountAddress);
      console.log("✅ Static call successful - transaction would succeed");
    } catch (staticError: any) {
      console.error("❌ Static call failed:", staticError.message);
      
      // Check if it's the balance limit
      if (staticError.message.includes("Already has enough tokens")) {
        console.log("The smart account already has enough tokens (>= 10000 mUSDC)");
      }
      return;
    }
    
    // Test with different gas settings (simulating Web3Auth behavior)
    console.log("\n=== TESTING DIFFERENT GAS SETTINGS ===");
    
    // Test 1: Exact gas estimate
    try {
      const gasEstimate = await mockUSDC.faucetTo.estimateGas(smartAccountAddress);
      console.log("Test 1: Using exact gas estimate:", gasEstimate.toString());
      
      const tx1 = await mockUSDC.faucetTo(smartAccountAddress, {
        gasLimit: gasEstimate
      });
      console.log("✅ Test 1 successful - Transaction hash:", tx1.hash);
      await tx1.wait();
      console.log("✅ Test 1 confirmed");
      
    } catch (error1: any) {
      console.error("❌ Test 1 failed:", error1.message);
      
      // Test 2: With buffer (like Web3Auth might do)
      try {
        const gasEstimate = await mockUSDC.faucetTo.estimateGas(smartAccountAddress);
        const gasWithBuffer = gasEstimate * 120n / 100n; // 20% buffer
        console.log("Test 2: Using gas with 20% buffer:", gasWithBuffer.toString());
        
        const tx2 = await mockUSDC.faucetTo(smartAccountAddress, {
          gasLimit: gasWithBuffer
        });
        console.log("✅ Test 2 successful - Transaction hash:", tx2.hash);
        await tx2.wait();
        console.log("✅ Test 2 confirmed");
        
      } catch (error2: any) {
        console.error("❌ Test 2 failed:", error2.message);
        
        // Test 3: Without explicit gas (let provider decide)
        try {
          console.log("Test 3: Using provider default gas");
          
          const tx3 = await mockUSDC.faucetTo(smartAccountAddress);
          console.log("✅ Test 3 successful - Transaction hash:", tx3.hash);
          await tx3.wait();
          console.log("✅ Test 3 confirmed");
          
        } catch (error3: any) {
          console.error("❌ Test 3 failed:", error3.message);
          console.error("All gas setting tests failed!");
        }
      }
    }
    
    // Final balance check
    console.log("\n=== FINAL BALANCES ===");
    const finalSmartAccountBalance = await mockUSDC.balanceOf(smartAccountAddress);
    console.log("Smart account balance:", hreEthers.formatUnits(finalSmartAccountBalance, 6), "mUSDC");
    
  } catch (error: any) {
    console.error("❌ Debug script failed:", error.message);
    console.error("Full error:", error);
  }
}

main().catch(console.error);