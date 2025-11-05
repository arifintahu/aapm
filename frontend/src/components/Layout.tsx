import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Wallet, LogOut, User, TrendingUp, RefreshCw, Shield, Menu, X } from "lucide-react";

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-[100dvh] bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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
              <div className="hidden md:flex items-center space-x-4">
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="min-w-[48px] min-h-[48px] p-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh data"
                  aria-label="Refresh data"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                {/* Balance */}
                <div className="bg-white/10 rounded-lg px-3 py-2 border border-white/20 group relative">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-gray-300" />
                    <span className="text-sm text-gray-300">Balance:</span>
                    <span className="font-semibold text-white">
                      {parseFloat(usdcBalance).toFixed(2)} USDC
                    </span>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg border border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none">
                    Smart Account Balance
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>

                {/* Wallet Button */}
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors min-h-[48px]"
                  aria-label="Open wallet"
                >
                  <Wallet className="h-5 w-5" />
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
                    className="min-w-[48px] min-h-[48px] p-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Logout"
                    aria-label="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-300">
                <User className="h-5 w-5" />
                <span>Not connected</span>
              </div>
            )}

            {/* Mobile menu toggle */}
            {isAuthenticated && user && (
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className="min-w-[48px] min-h-[48px] p-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}
          </div>
          {/* Mobile dropdown menu */}
          {mobileMenuOpen && isAuthenticated && user && (
            <div className="md:hidden bg-black/70 backdrop-blur-md border border-white/10 rounded-lg mt-2 p-3 text-white">
              <div className="space-y-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-lg px-3 py-3 disabled:opacity-50"
                  aria-label="Refresh data"
                >
                  <span className="text-sm">Refresh</span>
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="w-full bg-white/5 rounded-lg px-3 py-3 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-gray-300" />
                      <span className="text-sm text-gray-300">Balance</span>
                    </div>
                    <span className="font-semibold text-white">
                      {parseFloat(usdcBalance).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setShowWalletModal(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-between bg-purple-600 hover:bg-purple-700 rounded-lg px-3 py-3"
                  aria-label="Open wallet"
                >
                  <span className="text-sm">Wallet</span>
                  <Wallet className="h-5 w-5" />
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-lg px-3 py-3"
                  aria-label="Logout"
                >
                  <span className="text-sm">Logout</span>
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
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
              Gasless prediction betting powered by Web3Auth and Gassless Smart Accounts
            </p>
            <div className="mt-4 flex justify-center space-x-6 text-sm text-gray-400">
              <span>⚡ Gasless Transactions</span>
              <span>🔒 Social login</span>
              <span>✨ Smart Accounts</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}