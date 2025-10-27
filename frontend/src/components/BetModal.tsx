import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Outcome } from "@/lib/contracts";
import { X, TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react";

export default function BetModal() {
  const {
    showBetModal,
    setShowBetModal,
    selectedEventId,
    events,
    usdcBalance,
    placeBet,
    isLoading,
  } = useAppStore();

  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(Outcome.Yes);
  const [betAmount, setBetAmount] = useState("");
  const [error, setError] = useState("");

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const balance = parseFloat(usdcBalance);
  const amount = parseFloat(betAmount) || 0;

  useEffect(() => {
    if (!showBetModal) {
      setBetAmount("");
      setError("");
      setSelectedOutcome(Outcome.Yes);
    }
  }, [showBetModal]);

  const handleClose = () => {
    setShowBetModal(false);
  };

  const handleAmountChange = (value: string) => {
    setBetAmount(value);
    setError("");
    
    const numValue = parseFloat(value);
    if (numValue > balance) {
      setError("Insufficient balance");
    } else if (numValue <= 0) {
      setError("Amount must be greater than 0");
    }
  };

  const handleMaxClick = () => {
    setBetAmount(balance.toString());
    setError("");
  };

  const handlePlaceBet = async () => {
    if (!selectedEvent || !betAmount || amount <= 0) {
      setError("Please enter a valid bet amount");
      return;
    }

    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }

    try {
      setError("");
      await placeBet(selectedEvent.id, selectedOutcome, betAmount);
      handleClose();
    } catch (error: any) {
      console.error("Bet failed:", error);
      setError(error.message || "Failed to place bet");
    }
  };

  if (!showBetModal || !selectedEvent) {
    return null;
  }

  const totalPool = parseFloat(selectedEvent.totalYesAmount) + parseFloat(selectedEvent.totalNoAmount);
  const yesPercentage = totalPool > 0 ? (parseFloat(selectedEvent.totalYesAmount) / totalPool) * 100 : 50;
  const noPercentage = totalPool > 0 ? (parseFloat(selectedEvent.totalNoAmount) / totalPool) * 100 : 50;

  // Calculate potential winnings (simplified)
  const currentPool = selectedOutcome === Outcome.Yes ? parseFloat(selectedEvent.totalYesAmount) : parseFloat(selectedEvent.totalNoAmount);
  const oppositePool = selectedOutcome === Outcome.Yes ? parseFloat(selectedEvent.totalNoAmount) : parseFloat(selectedEvent.totalYesAmount);
  const potentialWinnings = amount > 0 ? (amount * (totalPool + amount)) / (currentPool + amount) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/20 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Place Your Bet</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Event Info */}
          <div className="space-y-2">
            <h3 className="font-medium text-white line-clamp-2">
              {selectedEvent.question}
            </h3>
            <div className="text-sm text-gray-400">
              Total Pool: {totalPool.toFixed(2)} USDC
            </div>
          </div>

          {/* Outcome Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">
              Choose Your Prediction
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedOutcome(Outcome.Yes)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedOutcome === Outcome.Yes
                    ? "bg-green-500/20 border-green-500 text-green-400"
                    : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10"
                }`}
                disabled={isLoading}
              >
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-semibold">YES</span>
                </div>
                <div className="text-sm">{yesPercentage.toFixed(1)}%</div>
                <div className="text-xs mt-1">
                  {parseFloat(selectedEvent.totalYesAmount).toFixed(2)} USDC
                </div>
              </button>

              <button
                onClick={() => setSelectedOutcome(Outcome.No)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedOutcome === Outcome.No
                    ? "bg-red-500/20 border-red-500 text-red-400"
                    : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10"
                }`}
                disabled={isLoading}
              >
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <TrendingDown className="h-5 w-5" />
                  <span className="font-semibold">NO</span>
                </div>
                <div className="text-sm">{noPercentage.toFixed(1)}%</div>
                <div className="text-xs mt-1">
                  {parseFloat(selectedEvent.totalNoAmount).toFixed(2)} USDC
                </div>
              </button>
            </div>
          </div>

          {/* Bet Amount */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300">
                Bet Amount
              </label>
              <div className="text-sm text-gray-400">
                Balance: {balance.toFixed(2)} USDC
              </div>
            </div>
            
            <div className="relative">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isLoading}
                min="0"
                step="0.01"
              />
              <button
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300 text-sm font-medium"
                disabled={isLoading}
              >
                MAX
              </button>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => handleAmountChange(Math.min(quickAmount, balance).toString())}
                  className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                  disabled={isLoading || balance < quickAmount}
                >
                  {quickAmount}
                </button>
              ))}
            </div>
          </div>

          {/* Potential Winnings */}
          {amount > 0 && (
            <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300">Potential Winnings</span>
                <span className="font-semibold text-purple-200">
                  {potentialWinnings.toFixed(2)} USDC
                </span>
              </div>
              <div className="text-xs text-purple-300 mt-1">
                Includes your bet amount
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-400 bg-red-500/20 rounded-lg p-3 border border-red-500/30">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handlePlaceBet}
              disabled={isLoading || !betAmount || amount <= 0 || amount > balance || !!error}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Placing Bet...</span>
                </>
              ) : (
                <span>Place Bet</span>
              )}
            </button>
          </div>

          {/* Gasless Info */}
          <div className="text-center text-xs text-gray-400">
            ⚡ This transaction is gasless - no ETH required!
          </div>
        </div>
      </div>
    </div>
  );
}