import React from "react";
import { useAppStore } from "@/lib/store";
import { Wallet, LogOut, User, TrendingUp, RefreshCw } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { 
    isAuthenticated, 
    user, 
    usdcBalance, 
    logout, 
    setShowWalletModal,
    isLoading,
    loadBalance,
    loadEvents
  } = useAppStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([loadBalance(), loadEvents()]);
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-purple-400" />
              <h1 className="text-xl font-bold text-white">
                Prediction Market
              </h1>
            </div>

            {/* User Info & Actions */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                {/* Balance */}
                <div className="bg-white/10 rounded-lg px-3 py-2 border border-white/20">
                  <span className="text-sm text-gray-300">Balance:</span>
                  <span className="ml-2 font-semibold text-white">
                    {parseFloat(usdcBalance).toFixed(2)} USDC
                  </span>
                </div>

                {/* Wallet Button */}
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Wallet</span>
                </button>

                {/* User Menu */}
                <div className="flex items-center space-x-2">
                  {user.profileImage && (
                    <img
                      src={user.profileImage}
                      alt="Profile"
                      className="h-8 w-8 rounded-full border-2 border-white/20"
                    />
                  )}
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-white">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-gray-300">
                      {user.address?.slice(0, 6)}...{user.address?.slice(-4)}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-300">
                <User className="h-5 w-5" />
                <span>Not connected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-md border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <TrendingUp className="h-6 w-6 text-purple-400" />
              <span className="text-lg font-semibold text-white">Prediction Market</span>
            </div>
            <p className="text-gray-300 text-sm">
              Gasless prediction betting powered by Web3Auth and Biconomy
            </p>
            <div className="mt-4 flex justify-center space-x-6 text-sm text-gray-400">
              <span>✨ No gas fees</span>
              <span>🔒 Social login</span>
              <span>⚡ Instant transactions</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}