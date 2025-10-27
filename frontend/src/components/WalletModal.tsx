import React from "react";
import { useAppStore } from "@/lib/store";
import { X, Copy, ExternalLink, Droplets, Loader2, CheckCircle } from "lucide-react";

export default function WalletModal() {
  const {
    showWalletModal,
    setShowWalletModal,
    user,
    usdcBalance,
    claimFaucet,
    isLoading,
  } = useAppStore();

  const [copied, setCopied] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);

  const handleClose = () => {
    setShowWalletModal(false);
  };

  const handleCopyAddress = async () => {
    if (user?.address) {
      await navigator.clipboard.writeText(user.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClaimFaucet = async () => {
    try {
      setClaiming(true);
      await claimFaucet();
    } catch (error) {
      console.error("Faucet claim failed:", error);
    } finally {
      setClaiming(false);
    }
  };

  const handleViewOnExplorer = () => {
    if (user?.address) {
      window.open(`https://sepolia.etherscan.io/address/${user.address}`, '_blank');
    }
  };

  if (!showWalletModal || !user) {
    return null;
  }

  const balance = parseFloat(usdcBalance);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-white/20 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Your Wallet</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="text-center space-y-3">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt="Profile"
                className="h-16 w-16 rounded-full mx-auto"
              />
            ) : (
              <div className="h-16 w-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto">
                <span className="text-xl font-semibold text-white">
                  {user.name?.charAt(0) || "U"}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {user.name || "User"}
              </h3>
              {user.email && (
                <p className="text-sm text-gray-400">{user.email}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Wallet Address
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white/10 rounded-lg px-3 py-2 font-mono text-sm text-white">
                {user.address.slice(0, 6)}...{user.address.slice(-4)}
              </div>
              <button
                onClick={handleCopyAddress}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={handleViewOnExplorer}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="View on Etherscan"
              >
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-4 border border-purple-500/30">
              <div className="text-center space-y-2">
                <div className="text-sm text-gray-300">USDC Balance</div>
                <div className="text-3xl font-bold text-white">
                  {balance.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">
                  Sepolia Testnet
                </div>
              </div>
            </div>

            {/* Faucet */}
            <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Droplets className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-blue-300">Test Faucet</span>
                </div>
              </div>
              <p className="text-sm text-blue-200 mb-3">
                Get 1000 USDC for testing. You can claim once every 24 hours.
              </p>
              <button
                onClick={handleClaimFaucet}
                disabled={claiming || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : (
                  <>
                    <Droplets className="h-4 w-4" />
                    <span>Claim 1000 USDC</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Network Info */}
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-white">Network Information</h4>
            <div className="space-y-1 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Network:</span>
                <span>Sepolia Testnet</span>
              </div>
              <div className="flex justify-between">
                <span>Chain ID:</span>
                <span>11155111</span>
              </div>
              <div className="flex justify-between">
                <span>Account Type:</span>
                <span>Smart Account</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="text-center space-y-2">
            <div className="text-sm text-gray-400">Powered by</div>
            <div className="flex justify-center space-x-4 text-xs text-gray-500">
              <span>🔐 Web3Auth</span>
              <span>⚡ Biconomy</span>
              <span>🌐 Sepolia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}