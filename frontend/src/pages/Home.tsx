import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import LoginButton from "@/components/LoginButton";
import Layout from "@/components/Layout";
import EventCard from "@/components/EventCard";
import WalletModal from "@/components/WalletModal";
import BetModal from "@/components/BetModal";
import { Loader2, TrendingUp } from "lucide-react";

export default function Home() {
  const { 
    isAuthenticated, 
    isInitializing, 
    events, 
    loadEvents, 
    initialize,
    isLoading 
  } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, loadEvents]);

  // Show loading spinner during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-white text-lg">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <LoginButton />
      </div>
    );
  }

  // Show main app when authenticated
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Prediction Market
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Place bets on future events with gasless transactions using USDC.
          </p>
        </div>

        {/* Events Section */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <TrendingUp className="h-6 w-6 mr-2 text-purple-400" />
              Active Events
            </h2>
            {isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            )}
          </div>

          {events.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Events Available</h3>
              <p className="text-gray-300">
                There are currently no active prediction events. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <WalletModal />
      <BetModal />
    </Layout>
  );
}