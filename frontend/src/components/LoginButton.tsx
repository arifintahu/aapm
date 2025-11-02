import React from "react";
import { useAppStore } from "@/lib/store";
import { LogIn, Loader2, TrendingUp, Sparkles, Shield, Zap } from "lucide-react";

export default function LoginButton() {
  const { login, isLoading } = useAppStore();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
      // You could add toast notification here
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* Hero Section */}
      <div className="text-center space-y-6 mb-12">
        <div className="flex items-center justify-center space-x-3 mb-6">
          <TrendingUp className="h-12 w-12 text-purple-400" />
          <h1 className="text-5xl md:text-6xl font-bold text-white">
            Prediction Market
          </h1>
        </div>
        <p className="text-xl md:text-2xl text-gray-300 max-w-3xl leading-relaxed">
          Experience the future of prediction betting with gasless transactions and social login. 
          No seed phrases, no gas fees - just pure prediction fun!
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 text-center">
          <Sparkles className="h-8 w-8 text-purple-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">No Wallet Setup</h3>
          <p className="text-gray-300 text-sm">Login with Google - no complex wallet setup required</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 text-center">
          <Zap className="h-8 w-8 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Gasless Transactions</h3>
          <p className="text-gray-300 text-sm">All transactions are sponsored - bet without paying gas</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 text-center">
          <Shield className="h-8 w-8 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Secure & Safe</h3>
          <p className="text-gray-300 text-sm">Gasless Smart Account with user authorization</p>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">Get Started</h2>
            <p className="text-gray-300">
              Connect with Google or MetaMask to start betting on prediction markets
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="flex items-center justify-center space-x-3 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                <span>Connect Wallet</span>
              </>
            )}
          </button>

          <div className="text-sm text-gray-400 space-y-2 pt-4 border-t border-white/10">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-1">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>No wallet setup</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4 text-blue-400" />
                <span>Gasless</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="h-4 w-4 text-green-400" />
                <span>Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Text */}
      <p className="text-gray-400 text-sm mt-8 text-center max-w-md">
        By connecting, you agree to our terms of service and privacy policy. 
        Your data is protected and never shared.
      </p>
    </div>
  );
}