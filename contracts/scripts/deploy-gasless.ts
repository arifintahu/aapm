import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("Deploying gasless infrastructure contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy SmartAccountFactory
  console.log("\nDeploying SmartAccountFactory...");
  const SmartAccountFactory = await ethers.getContractFactory("SmartAccountFactory");
  
  // Use deployer as the default gas payer for now
  const factory = await SmartAccountFactory.deploy(deployer.address);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("SmartAccountFactory deployed to:", factoryAddress);

  // Create a test smart account to verify deployment
  console.log("\nCreating test smart account...");
  const testOwner = ethers.Wallet.createRandom().address;
  const salt = ethers.randomBytes(32);
  
  // Get predicted address
  const predictedAddress = await factory.getSmartAccountAddress(testOwner, salt);
  console.log("Predicted smart account address:", predictedAddress);
  
  // Create the smart account
  const createTx = await factory.createSmartAccount(testOwner, salt);
  await createTx.wait();
  
  console.log("Test smart account created successfully!");
  
  // Verify the smart account
  const smartAccounts = await factory.getUserSmartAccounts(testOwner);
  console.log("Smart accounts for test owner:", smartAccounts);
  
  const isValid = await factory.isValidSmartAccount(smartAccounts[0]);
  console.log("Is valid smart account:", isValid);

  // Save deployment addresses
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      SmartAccountFactory: factoryAddress,
    },
    testData: {
      testOwner,
      testSmartAccount: smartAccounts[0],
      predictedAddress
    },
    timestamp: new Date().toISOString()
  };

  const deploymentPath = join(__dirname, "..", "deployments", `gasless-${deploymentInfo.network.name}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\nDeployment completed!");
  console.log("Deployment info saved to:", deploymentPath);
  console.log("\nContract addresses:");
  console.log("SmartAccountFactory:", factoryAddress);
  console.log("Test SmartAccount:", smartAccounts[0]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });