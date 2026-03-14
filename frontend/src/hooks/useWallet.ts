import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner, Contract } from "ethers";
import { CONTRACT_ADDRESS, DAONANCE_ABI } from "../utils/contract";

export interface WalletState {
  address: string | null;
  signer: JsonRpcSigner | null;
  contract: Contract | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

function getEthereum() {
  if (typeof window !== "undefined" && window.ethereum) {
    return window.ethereum;
  }
  return null;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setContract(null);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("Please install MetaMask");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      // Force MetaMask to prompt for account selection instead of silently reconnecting
      await eth.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      await eth.request({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(eth);
      const s = await provider.getSigner();
      const addr = await s.getAddress();
      const c = new Contract(CONTRACT_ADDRESS, DAONANCE_ABI, s);
      setAddress(addr);
      setSigner(s);
      setContract(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setAddress(null);
        setSigner(null);
        setContract(null);
      } else {
        connect();
      }
    };

    try {
      eth.on("accountsChanged", handleAccountsChanged);
    } catch {
      // Some wallets don't support event listeners
    }

    return () => {
      try {
        eth.removeListener("accountsChanged", handleAccountsChanged);
      } catch {
        // Cleanup silently
      }
    };
  }, [connect]);

  return { address, signer, contract, isConnecting, error, connect, disconnect };
}
