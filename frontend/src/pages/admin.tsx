import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import Layout from "@/components/Layout";
import { contractService, EventStatus, Outcome } from "@/lib/contracts";
import { 
  Plus, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Users, 
  DollarSign,
  Loader2,
  AlertCircle 
} from "lucide-react";

export default function AdminPage() {
  const { isAuthenticated, user, events, loadEvents } = useAppStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Create event form
  const [question, setQuestion] = useState("");
  const [endTime, setEndTime] = useState("");
  
  // Resolution
  const [resolvingEventId, setResolvingEventId] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, loadEvents]);

  const handleCreateEvent = async () => {
    if (!question.trim() || !endTime) {
      setError("Please fill in all fields");
      return;
    }

    const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    
    if (endTimestamp <= now) {
      setError("End time must be in the future");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      await contractService.createEvent(question.trim(), endTimestamp);
      
      // Reset form
      setQuestion("");
      setEndTime("");
      setShowCreateModal(false);
      
      // Reload events
      await loadEvents();
    } catch (error: any) {
      console.error("Failed to create event:", error);
      setError(error.message || "Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveEvent = async (eventId: number, outcome: Outcome) => {
    try {
      setResolvingEventId(eventId);
      
      await contractService.resolveEvent(eventId, outcome);
      
      // Reload events
      await loadEvents();
    } catch (error: any) {
      console.error("Failed to resolve event:", error);
      setError(error.message || "Failed to resolve event");
    } finally {
      setResolvingEventId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // Minimum 30 minutes from now
    return now.toISOString().slice(0, 16);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-white mb-4">Admin Panel</h1>
          <p className="text-gray-300">Please connect your wallet to access the admin panel.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-300 mt-2">Manage prediction market events</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            <span>Create Event</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center space-x-2 text-red-400 bg-red-500/20 rounded-lg p-4 border border-red-500/30">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">All Events</h2>
          
          {events.length > 0 ? (
            <div className="grid gap-6">
              {events.map((event) => {
                const totalPool = parseFloat(event.totalYesAmount) + parseFloat(event.totalNoAmount);
                const isActive = event.status === EventStatus.Active;
                const isResolved = event.status === EventStatus.Resolved;
                const canResolve = isActive && Date.now() / 1000 > event.endTime;
                
                return (
                  <div
                    key={event.id}
                    className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {event.question}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-300">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Ends: {formatDate(event.endTime)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{event.totalBets} bets</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4" />
                            <span>{totalPool.toFixed(2)} USDC</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                        isActive ? "bg-green-500" : 
                        isResolved ? "bg-blue-500" : "bg-red-500"
                      }`}>
                        {isActive ? "Active" : isResolved ? "Resolved" : "Cancelled"}
                      </div>
                    </div>

                    {/* Pool Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
                        <div className="text-sm text-green-400 mb-1">YES Bets</div>
                        <div className="text-lg font-semibold text-white">
                          {parseFloat(event.totalYesAmount).toFixed(2)} USDC
                        </div>
                      </div>
                      <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
                        <div className="text-sm text-red-400 mb-1">NO Bets</div>
                        <div className="text-lg font-semibold text-white">
                          {parseFloat(event.totalNoAmount).toFixed(2)} USDC
                        </div>
                      </div>
                    </div>

                    {/* Resolution Result */}
                    {isResolved && (
                      <div className="mb-4 p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <div className="flex items-center space-x-2">
                          {event.outcome === Outcome.Yes ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-400" />
                          )}
                          <span className="text-blue-300">
                            Resolved: {event.outcome === Outcome.Yes ? "YES" : "NO"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {canResolve && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleResolveEvent(event.id, Outcome.Yes)}
                          disabled={resolvingEventId === event.id}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                          {resolvingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          <span>Resolve YES</span>
                        </button>
                        <button
                          onClick={() => handleResolveEvent(event.id, Outcome.No)}
                          disabled={resolvingEventId === event.id}
                          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                          {resolvingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span>Resolve NO</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Events</h3>
              <p className="text-gray-300">Create your first prediction event to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/20 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Create New Event</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError("");
                  setQuestion("");
                  setEndTime("");
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                disabled={isLoading}
              >
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Event Question
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Will Bitcoin reach $100,000 by the end of 2024?"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  min={getMinDateTime()}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-400 bg-red-500/20 rounded-lg p-3 border border-red-500/30">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError("");
                    setQuestion("");
                    setEndTime("");
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={isLoading || !question.trim() || !endTime}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Create Event</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}