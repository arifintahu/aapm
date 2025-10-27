import React from "react";
import { useAppStore } from "@/lib/store";
import { Wallet, LogOut, User, TrendingUp } from "lucide-react";

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
    isLoading 
  } = useAppStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
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
                {/* Balance */}
                <div className="bg-white/10 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-300">Balance:</span>
                  <span className="ml-2 font-semibold text-white">
                    {parseFloat(usdcBalance).toFixed(2)} USDC
                  </span>
                </div>

                {/* Wallet Button */}
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  disabled={isLoading}
                >
                  <Wallet className="h-4 w-4" />
                  <span>Wallet</span>
                </button>

                {/* User Menu */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {user.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt="Profile"
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className="hidden sm:block">
                      <p className="text-sm font-medium text-white">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs text-gray-300">
                        {user.address.slice(0, 6)}...{user.address.slice(-4)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    disabled={isLoading}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-white">
                <span className="text-sm">Connect your wallet to start betting</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black/20 backdrop-blur-md border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-300">
            <p className="text-sm">
              Gasless Prediction Market powered by Biconomy &amp; Web3Auth
            </p>
            <p className="text-xs mt-2">
              Built with Next.js, TypeScript, and Tailwind CSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}