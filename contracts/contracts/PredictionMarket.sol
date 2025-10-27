// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @dev A simple prediction market contract for binary outcomes
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    enum EventStatus { Active, Resolved }
    enum Outcome { None, Yes, No }
    
    struct Event {
        string question;
        uint256 endTime;
        EventStatus status;
        Outcome result;
        uint256 totalYesBets;
        uint256 totalNoBets;
        uint256 totalPool;
    }
    
    struct Bet {
        uint256 eventId;
        address bettor;
        Outcome prediction;
        uint256 amount;
        bool claimed;
    }
    
    IERC20 public immutable bettingToken;
    uint256 public eventCounter;
    uint256 public constant PLATFORM_FEE = 200; // 2% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    
    mapping(uint256 => Event) public events;
    mapping(uint256 => Bet[]) public eventBets;
    mapping(address => uint256[]) public userBets;
    mapping(uint256 => mapping(address => uint256[])) public userEventBets;
    
    event EventCreated(uint256 indexed eventId, string question, uint256 endTime);
    event BetPlaced(uint256 indexed eventId, address indexed bettor, Outcome prediction, uint256 amount);
    event EventResolved(uint256 indexed eventId, Outcome result);
    event WinningsClaimed(uint256 indexed eventId, address indexed winner, uint256 amount);
    
    constructor(address _bettingToken) Ownable(msg.sender) {
        require(_bettingToken != address(0), "Invalid token address");
        bettingToken = IERC20(_bettingToken);
    }
    
    /**
     * @dev Create a new prediction event
     * @param question The question for the prediction
     * @param duration Duration in seconds from now
     */
    function createEvent(string memory question, uint256 duration) external onlyOwner {
        require(bytes(question).length > 0, "Question cannot be empty");
        require(duration > 0, "Duration must be positive");
        
        uint256 eventId = eventCounter++;
        uint256 endTime = block.timestamp + duration;
        
        events[eventId] = Event({
            question: question,
            endTime: endTime,
            status: EventStatus.Active,
            result: Outcome.None,
            totalYesBets: 0,
            totalNoBets: 0,
            totalPool: 0
        });
        
        emit EventCreated(eventId, question, endTime);
    }
    
    /**
     * @dev Place a bet on an event
     * @param eventId The ID of the event
     * @param prediction The predicted outcome (Yes or No)
     * @param amount The amount to bet
     */
    function placeBet(uint256 eventId, Outcome prediction, uint256 amount) external nonReentrant {
        require(eventId < eventCounter, "Event does not exist");
        require(prediction == Outcome.Yes || prediction == Outcome.No, "Invalid prediction");
        require(amount > 0, "Amount must be positive");
        
        Event storage eventData = events[eventId];
        require(eventData.status == EventStatus.Active, "Event not active");
        require(block.timestamp < eventData.endTime, "Event has ended");
        
        // Transfer tokens from user
        bettingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create bet record
        Bet memory newBet = Bet({
            eventId: eventId,
            bettor: msg.sender,
            prediction: prediction,
            amount: amount,
            claimed: false
        });
        
        eventBets[eventId].push(newBet);
        userBets[msg.sender].push(eventBets[eventId].length - 1);
        userEventBets[eventId][msg.sender].push(eventBets[eventId].length - 1);
        
        // Update event totals
        if (prediction == Outcome.Yes) {
            eventData.totalYesBets += amount;
        } else {
            eventData.totalNoBets += amount;
        }
        eventData.totalPool += amount;
        
        emit BetPlaced(eventId, msg.sender, prediction, amount);
    }
    
    /**
     * @dev Resolve an event with the final outcome
     * @param eventId The ID of the event
     * @param result The final outcome
     */
    function resolveEvent(uint256 eventId, Outcome result) external onlyOwner {
        require(eventId < eventCounter, "Event does not exist");
        require(result == Outcome.Yes || result == Outcome.No, "Invalid result");
        
        Event storage eventData = events[eventId];
        require(eventData.status == EventStatus.Active, "Event already resolved");
        require(block.timestamp >= eventData.endTime, "Event has not ended yet");
        
        eventData.status = EventStatus.Resolved;
        eventData.result = result;
        
        emit EventResolved(eventId, result);
    }
    
    /**
     * @dev Claim winnings for a specific event
     * @param eventId The ID of the event
     */
    function claimWinnings(uint256 eventId) external nonReentrant {
        require(eventId < eventCounter, "Event does not exist");
        
        Event storage eventData = events[eventId];
        require(eventData.status == EventStatus.Resolved, "Event not resolved");
        
        uint256 totalWinnings = 0;
        uint256[] storage userBetIndices = userEventBets[eventId][msg.sender];
        
        for (uint256 i = 0; i < userBetIndices.length; i++) {
            Bet storage bet = eventBets[eventId][userBetIndices[i]];
            
            if (!bet.claimed && bet.prediction == eventData.result) {
                bet.claimed = true;
                
                // Calculate winnings based on pool distribution
                uint256 winningPool = eventData.result == Outcome.Yes ? eventData.totalYesBets : eventData.totalNoBets;
                uint256 losingPool = eventData.result == Outcome.Yes ? eventData.totalNoBets : eventData.totalYesBets;
                
                if (winningPool > 0) {
                    // Winner gets their bet back + proportional share of losing pool (minus platform fee)
                    uint256 platformFee = (losingPool * PLATFORM_FEE) / BASIS_POINTS;
                    uint256 distributionPool = losingPool - platformFee;
                    uint256 proportionalWin = (bet.amount * distributionPool) / winningPool;
                    totalWinnings += bet.amount + proportionalWin;
                }
            }
        }
        
        require(totalWinnings > 0, "No winnings to claim");
        bettingToken.safeTransfer(msg.sender, totalWinnings);
        
        emit WinningsClaimed(eventId, msg.sender, totalWinnings);
    }
    
    /**
     * @dev Get event details
     * @param eventId The ID of the event
     */
    function getEvent(uint256 eventId) external view returns (Event memory) {
        require(eventId < eventCounter, "Event does not exist");
        return events[eventId];
    }
    
    /**
     * @dev Get user's bets for a specific event
     * @param eventId The ID of the event
     * @param user The user's address
     */
    function getUserEventBets(uint256 eventId, address user) external view returns (Bet[] memory) {
        uint256[] storage betIndices = userEventBets[eventId][user];
        Bet[] memory userBetsArray = new Bet[](betIndices.length);
        
        for (uint256 i = 0; i < betIndices.length; i++) {
            userBetsArray[i] = eventBets[eventId][betIndices[i]];
        }
        
        return userBetsArray;
    }
    
    /**
     * @dev Get total number of bets for an event
     * @param eventId The ID of the event
     */
    function getEventBetCount(uint256 eventId) external view returns (uint256) {
        return eventBets[eventId].length;
    }
    
    /**
     * @dev Calculate potential winnings for a bet
     * @param eventId The ID of the event
     * @param prediction The predicted outcome
     * @param amount The bet amount
     */
    function calculatePotentialWinnings(uint256 eventId, Outcome prediction, uint256 amount) 
        external view returns (uint256) {
        require(eventId < eventCounter, "Event does not exist");
        
        Event storage eventData = events[eventId];
        require(eventData.status == EventStatus.Active, "Event not active");
        
        uint256 currentYesBets = eventData.totalYesBets;
        uint256 currentNoBets = eventData.totalNoBets;
        
        // Simulate adding this bet
        if (prediction == Outcome.Yes) {
            currentYesBets += amount;
        } else {
            currentNoBets += amount;
        }
        
        uint256 winningPool = prediction == Outcome.Yes ? currentYesBets : currentNoBets;
        uint256 losingPool = prediction == Outcome.Yes ? currentNoBets : currentYesBets;
        
        if (winningPool == 0 || losingPool == 0) {
            return amount; // Just get bet back if no opposing bets
        }
        
        uint256 platformFee = (losingPool * PLATFORM_FEE) / BASIS_POINTS;
        uint256 distributionPool = losingPool - platformFee;
        uint256 proportionalWin = (amount * distributionPool) / winningPool;
        
        return amount + proportionalWin;
    }
    
    /**
     * @dev Withdraw platform fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = bettingToken.balanceOf(address(this));
        
        // Calculate total locked funds (active bets)
        uint256 lockedFunds = 0;
        for (uint256 i = 0; i < eventCounter; i++) {
            if (events[i].status == EventStatus.Active) {
                lockedFunds += events[i].totalPool;
            }
        }
        
        uint256 availableFees = balance > lockedFunds ? balance - lockedFunds : 0;
        require(availableFees > 0, "No fees to withdraw");
        
        bettingToken.safeTransfer(owner(), availableFees);
    }
}