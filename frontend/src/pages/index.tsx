import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import Layout from "@/components/Layout";
import LoginButton from "@/components/LoginButton";
import EventCard from "@/components/EventCard";
import BetModal from "@/components/BetModal";
import WalletModal from "@/components/WalletModal";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";

export default function Home() {
  const {
    isAuthenticated,
    isInitializing,
    events,
    loadEvents,
    initialize,
    isLoading,
  } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleRefresh = async () => {
    await loadEvents();
  };

  if (isInitializing) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto" />
            <p className="text-white text-lg">Initializing...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <LoginButton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <TrendingUp className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">
              Prediction Markets
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Place gasless bets on future events. No gas fees, just pure prediction fun!
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <div className="text-white">
            <span className="text-lg font-semibold">
              {events.length} Active Event{events.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Events Grid */}
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="space-y-4">
              <div className="text-6xl">🎯</div>
              <h3 className="text-2xl font-semibold text-white">
                No Events Available
              </h3>
              <p className="text-gray-300 max-w-md mx-auto">
                There are currently no prediction events available. Check back later or contact the admin to create new events.
              </p>
              <button
                onClick={handleRefresh}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Refresh Events
              </button>
            </div>
          </div>
        )}

        {/* Getting Started */}
        {events.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl p-8 border border-purple-500/30">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">
                How It Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="space-y-2">
                  <div className="text-3xl">🎯</div>
                  <h3 className="font-semibold text-white">Choose Event</h3>
                  <p className="text-sm text-gray-300">
                    Browse available prediction markets and select an event you want to bet on.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl">💰</div>
                  <h3 className="font-semibold text-white">Place Bet</h3>
                  <p className="text-sm text-gray-300">
                    Choose YES or NO and enter your bet amount. All transactions are gasless!
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl">🏆</div>
                  <h3 className="font-semibold text-white">Win Rewards</h3>
                  <p className="text-sm text-gray-300">
                    If your prediction is correct, claim your winnings when the event resolves.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BetModal />
      <WalletModal />
    </Layout>
  );
}