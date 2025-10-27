import React from "react";
import { useAppStore } from "@/lib/store";
import { LogIn, Loader2 } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold text-white">
          Welcome to Prediction Market
        </h2>
        <p className="text-xl text-gray-300 max-w-2xl">
          Experience gasless betting with social login. No seed phrases, no gas fees - just pure prediction fun!
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-white">Get Started</h3>
            <p className="text-gray-300">
              Connect with your Google account to start betting
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="flex items-center justify-center space-x-3 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                <span>Connect with Google</span>
              </>
            )}
          </button>

          <div className="text-sm text-gray-400 space-y-2">
            <p>✨ No wallet setup required</p>
            <p>⚡ Gasless transactions</p>
            <p>🔒 Secure social login</p>
          </div>
        </div>
      </div>
    </div>
  );
}