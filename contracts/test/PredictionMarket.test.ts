import { expect } from "chai";
import hre from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

describe("PredictionMarket", function () {
  let mockUSDC: Contract;
  let predictionMarket: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let ownerAddress: string;
  let user1Address: string;
  let user2Address: string;

  const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10,000 mUSDC
  const BET_AMOUNT = ethers.parseUnits("100", 6); // 100 mUSDC

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy PredictionMarket
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    predictionMarket = await PredictionMarket.deploy(await mockUSDC.getAddress());
    await predictionMarket.waitForDeployment();

    // Mint tokens to users
    await mockUSDC.mint(user1Address, INITIAL_BALANCE);
    await mockUSDC.mint(user2Address, INITIAL_BALANCE);

    // Approve prediction market to spend tokens
    await mockUSDC.connect(user1).approve(await predictionMarket.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(await predictionMarket.getAddress(), ethers.MaxUint256);
  });

  describe("Event Creation", function () {
    it("Should create an event successfully", async function () {
      const question = "Will it rain tomorrow?";
      const duration = 86400; // 1 day

      const tx = await predictionMarket.createEvent(question, duration);
      await expect(tx)
        .to.emit(predictionMarket, "EventCreated");

      // Verify event creation by checking event counter and basic properties
      const eventCounter = await predictionMarket.eventCounter();
      expect(eventCounter).to.equal(1);
      
      // Test the event data through individual calls to avoid struct compatibility issues
      const eventExists = await predictionMarket.events(0);
      expect(eventExists.question).to.equal(question);
      expect(eventExists.status).to.equal(0); // Active status
    });

    it("Should fail to create event with empty question", async function () {
      await expect(predictionMarket.createEvent("", 86400))
        .to.be.revertedWith("Question cannot be empty");
    });

    it("Should fail to create event with zero duration", async function () {
      await expect(predictionMarket.createEvent("Test question", 0))
        .to.be.revertedWith("Duration must be positive");
    });

    it("Should only allow owner to create events", async function () {
      await expect(predictionMarket.connect(user1).createEvent("Test", 86400))
        .to.be.revertedWithCustomError(predictionMarket, "OwnableUnauthorizedAccount");
    });
  });

  describe("Betting", function () {
    beforeEach(async function () {
      // Create a test event
      await predictionMarket.createEvent("Test event", 86400);
    });

    it("Should place a bet successfully", async function () {
      await expect(predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT)) // 1 = Yes
        .to.emit(predictionMarket, "BetPlaced")
        .withArgs(0, user1Address, 1, BET_AMOUNT);

      // Verify bet was placed by checking event state
      const eventData = await predictionMarket.events(0);
      expect(eventData.totalYesBets).to.equal(BET_AMOUNT);
      expect(eventData.totalPool).to.equal(BET_AMOUNT);
    });

    it("Should handle multiple bets on same event", async function () {
      // User1 bets Yes
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT);
      
      // User2 bets No
      await predictionMarket.connect(user2).placeBet(0, 2, BET_AMOUNT); // 2 = No

      // Verify both bets were placed correctly
      const eventData = await predictionMarket.events(0);
      expect(eventData.totalYesBets).to.equal(BET_AMOUNT);
      expect(eventData.totalNoBets).to.equal(BET_AMOUNT);
      expect(eventData.totalPool).to.equal(BET_AMOUNT * 2n);
    });

    it("Should fail to bet on non-existent event", async function () {
      await expect(predictionMarket.connect(user1).placeBet(999, 1, BET_AMOUNT))
        .to.be.revertedWith("Event does not exist");
    });

    it("Should fail to bet with invalid prediction", async function () {
      await expect(predictionMarket.connect(user1).placeBet(0, 0, BET_AMOUNT)) // 0 = None
        .to.be.revertedWith("Invalid prediction");
    });

    it("Should fail to bet zero amount", async function () {
      await expect(predictionMarket.connect(user1).placeBet(0, 1, 0))
        .to.be.revertedWith("Amount must be positive");
    });

    it("Should fail to bet after event ends", async function () {
      // Fast forward past event end time
      await time.increase(86401); // 1 day + 1 second

      await expect(predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT))
        .to.be.revertedWith("Event has ended");
    });
  });

  describe("Event Resolution", function () {
    beforeEach(async function () {
      // Create event and place some bets
      await predictionMarket.createEvent("Test event", 86400);
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT); // Yes
      await predictionMarket.connect(user2).placeBet(0, 2, BET_AMOUNT); // No
    });

    it("Should resolve event successfully", async function () {
      // Fast forward past event end time
      await time.increase(86401);

      await expect(predictionMarket.resolveEvent(0, 1)) // Resolve as Yes
        .to.emit(predictionMarket, "EventResolved")
        .withArgs(0, 1);

      // Verify event was resolved correctly
      const eventData = await predictionMarket.events(0);
      expect(eventData.status).to.equal(1); // Resolved status
      expect(eventData.result).to.equal(1); // Yes result
    });

    it("Should fail to resolve before event ends", async function () {
      await expect(predictionMarket.resolveEvent(0, 1))
        .to.be.revertedWith("Event has not ended yet");
    });

    it("Should fail to resolve with invalid result", async function () {
      await time.increase(86401);
      
      await expect(predictionMarket.resolveEvent(0, 0)) // 0 = None
        .to.be.revertedWith("Invalid result");
    });

    it("Should only allow owner to resolve events", async function () {
      await time.increase(86401);
      
      await expect(predictionMarket.connect(user1).resolveEvent(0, 1))
        .to.be.revertedWithCustomError(predictionMarket, "OwnableUnauthorizedAccount");
    });
  });

  describe("Claiming Winnings", function () {
    beforeEach(async function () {
      // Create event, place bets, and resolve
      await predictionMarket.createEvent("Test event", 86400);
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT); // Yes - Winner
      await predictionMarket.connect(user2).placeBet(0, 2, BET_AMOUNT); // No - Loser
      
      await time.increase(86401);
      await predictionMarket.resolveEvent(0, 1); // Yes wins
    });

    it("Should allow winner to claim winnings", async function () {
      const initialBalance = await mockUSDC.balanceOf(user1Address);
      
      await expect(predictionMarket.connect(user1).claimWinnings(0))
        .to.emit(predictionMarket, "WinningsClaimed");

      const finalBalance = await mockUSDC.balanceOf(user1Address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should fail to claim from unresolved event", async function () {
      // Create new unresolved event
      await predictionMarket.createEvent("Unresolved event", 86400);
      await predictionMarket.connect(user1).placeBet(1, 1, BET_AMOUNT);

      await expect(predictionMarket.connect(user1).claimWinnings(1))
        .to.be.revertedWith("Event not resolved");
    });

    it("Should fail to claim if no winnings", async function () {
      // User2 lost, so no winnings to claim
      await expect(predictionMarket.connect(user2).claimWinnings(0))
        .to.be.revertedWith("No winnings to claim");
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      await predictionMarket.createEvent("Test event", 86400);
    });

    it("Should calculate potential winnings correctly", async function () {
      // Place initial bet to establish odds
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT);

      const potentialWinnings = await predictionMarket.calculatePotentialWinnings(0, 2, BET_AMOUNT);
      expect(potentialWinnings).to.be.gt(BET_AMOUNT); // Should win more than bet amount
    });

    it("Should return user event bets", async function () {
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT);
      
      const userBets = await predictionMarket.getUserEventBets(0, user1Address);
      expect(userBets.length).to.equal(1);
      expect(userBets[0].amount).to.equal(BET_AMOUNT);
      expect(userBets[0].prediction).to.equal(1);
    });

    it("Should return correct bet count", async function () {
      await predictionMarket.connect(user1).placeBet(0, 1, BET_AMOUNT);
      await predictionMarket.connect(user2).placeBet(0, 2, BET_AMOUNT);
      
      const betCount = await predictionMarket.getEventBetCount(0);
      expect(betCount).to.equal(2);
    });
  });
});