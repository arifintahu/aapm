import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const mockUSDCAddress = "0xa49FeA13D29671C1203Dc1434b2647e71E24fdDc";
  
  try {
    const mockUSDC = await ethers.getContractAt("MockUSDC", mockUSDCAddress);
    console.log("Contract deployed at:", await mockUSDC.getAddress());
    
    // Check if faucetTo function exists
    const iface = mockUSDC.interface;
    console.log("faucetTo function exists:", iface.hasFunction("faucetTo"));
    
    // Try to get the function fragment
    try {
      const faucetToFragment = iface.getFunction("faucetTo");
      console.log("faucetTo function signature:", faucetToFragment.format());
    } catch (e) {
      console.log("faucetTo function not found in interface");
    }
    
    // List all functions
    console.log("\nAll functions in contract:");
    const functions = iface.fragments.filter(f => f.type === "function");
    functions.forEach(f => {
      console.log(`- ${f.name}: ${f.format()}`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);