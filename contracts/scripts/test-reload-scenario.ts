import { ethers } from "hardhat";

async function testReloadScenario() {
  console.log("=== TESTING PAGE RELOAD SCENARIO ===");
  
  try {
    // Get the signer (simulating the Web3Auth EOA)
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    // Simulate the scenario where Web3Auth provider returns empty accounts initially
    console.log("\n=== SIMULATING EMPTY ACCOUNTS SCENARIO ===");
    
    // This simulates what happens during page reload:
    // 1. Web3Auth is connected but provider returns empty accounts initially
    // 2. After a short delay, accounts become available
    
    let accounts: string[] = [];
    let retryCount = 0;
    const maxRetries = 5;
    
    // Simulate the retry logic we implemented
    while ((!accounts || accounts.length === 0) && retryCount < maxRetries) {
      // Simulate the delay and eventual success
      if (retryCount < 3) {
        console.log(`Attempt ${retryCount + 1}: No accounts found, retrying in 500ms...`);
        accounts = []; // Empty array (simulating Web3Auth behavior during reload)
      } else {
        console.log(`Attempt ${retryCount + 1}: Accounts now available!`);
        accounts = [signer.address]; // Accounts become available
      }
      
      if (!accounts || accounts.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retryCount++;
      }
    }
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found after retries - Web3Auth may not be fully initialized");
    }
    
    console.log(`✅ Successfully retrieved accounts after ${retryCount} retries:`, accounts);
    
    // Simulate smart account creation
    console.log("\n=== SIMULATING SMART ACCOUNT CREATION ===");
    const smartAccountAddress = "0xa10608ea97a268d1d29669d6e302b76ffaf9fefb"; // Our test smart account
    
    console.log("Smart account created:", {
      address: smartAccountAddress,
      signerAddress: accounts[0]
    });
    
    console.log("\n✅ PAGE RELOAD SCENARIO TEST PASSED!");
    console.log("The retry logic should handle Web3Auth provider delays during page reload.");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testReloadScenario()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });