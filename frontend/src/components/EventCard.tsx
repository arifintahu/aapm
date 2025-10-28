import React from "react";
import { PredictionEvent, EventStatus, Outcome } from "@/lib/contracts";
import { useAppStore } from "@/lib/store";
import { Calendar, Users, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from "lucide-react";
import { ethers } from "ethers";

interface EventCardProps {
  event: PredictionEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const { setSelectedEvent, setShowBetModal, userBets, loadUserBets } = useAppStore();
  
  const userEventBets = userBets[event.id] || [];
  const totalUserBets = userEventBets.reduce((sum, bet) => sum + parseFloat(ethers.formatUnits(bet.amount, 6)), 0);
  
  const totalPool = parseFloat(ethers.formatUnits(event.totalYesBets, 6)) + parseFloat(ethers.formatUnits(event.totalNoBets, 6));
  const yesAmount = parseFloat(ethers.formatUnits(event.totalYesBets, 6));
  const noAmount = parseFloat(ethers.formatUnits(event.totalNoBets, 6));
  const yesPercentage = totalPool > 0 ? (yesAmount / totalPool) * 100 : 50;
  const noPercentage = totalPool > 0 ? (noAmount / totalPool) * 100 : 50;

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case EventStatus.Active:
        return "bg-green-500";
      case EventStatus.Resolved:
        return "bg-blue-500";

      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: EventStatus) => {
    switch (status.toString()) {
      case EventStatus.Active.toString():
        return "Active";
      case EventStatus.Resolved.toString():
        return "Resolved";

      default:
        return "Unknown";
    }
  };

  const formatDate = (timestamp: bigint | number) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleBetClick = () => {
    setSelectedEvent(event.id);
    setShowBetModal(true);
    loadUserBets(event.id);
  };

  const currentTime = BigInt(Math.round(Date.now() / 1000));
  const canBet = event.status == EventStatus.Active && currentTime < event.endTime;
  const isResolved = event.status == EventStatus.Resolved;
  const hasUserBets = userEventBets.length > 0;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-200">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-3 min-h-[3.5rem]">
            <h3 className="text-lg font-semibold text-white mb-0 line-clamp-2 leading-tight break-words">
              {event.question}
            </h3>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs font-medium text-white flex-shrink-0 self-start ${getStatusColor(event.status)}`}>
            {getStatusText(event.status)}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-300 flex-wrap">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>Ends: {formatDate(event.endTime)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>Pool: {totalPool.toFixed(2)} USDC</span>
          </div>
        </div>
      </div>

      {/* Pool Information */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-300">Total Pool</span>
          <span className="text-lg font-semibold text-white">
            {totalPool.toFixed(2)} USDC
          </span>
        </div>
        
        {/* Odds Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">YES</span>
              </div>
              <span className="text-sm text-green-400">{yesPercentage.toFixed(1)}%</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {yesAmount.toFixed(2)} USDC
            </div>
          </div>
          
          <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">NO</span>
              </div>
              <span className="text-sm text-red-400">{noPercentage.toFixed(1)}%</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {noAmount.toFixed(2)} USDC
            </div>
          </div>
        </div>
      </div>

      {/* User Bets */}
      {hasUserBets && (
        <div className="mb-4 p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-sm text-purple-300">Your Total Bets</span>
            <span className="font-semibold text-purple-200">
              {totalUserBets.toFixed(2)} USDC
            </span>
          </div>
          <div className="text-xs text-purple-300 mt-1">
            {userEventBets.length} bet{userEventBets.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Resolution Result */}
      {isResolved && (
        <div className="mb-4 p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <div className="flex items-center space-x-2">
            {event.result === Outcome.Yes ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <span className="text-sm text-blue-300">
              Resolved: {event.result === Outcome.Yes ? "YES" : "NO"}
            </span>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex space-x-3">
        {canBet ? (
          <button
            onClick={handleBetClick}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Place Bet
          </button>
        ) : event.status === EventStatus.Active ? (
          <div className="flex-1 bg-gray-600 text-gray-300 font-semibold py-3 px-4 rounded-lg text-center">
            <div className="flex items-center justify-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Betting Closed</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-gray-600 text-gray-300 font-semibold py-3 px-4 rounded-lg text-center">
            Event Ended
          </div>
        )}
        
        {hasUserBets && isResolved && (
          <button
            onClick={() => {
              // This would trigger claim winnings
              console.log("Claim winnings for event", event.id);
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Claim
          </button>
        )}
      </div>
    </div>
  );
}