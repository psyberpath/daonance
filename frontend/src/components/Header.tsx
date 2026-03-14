import { Link } from "react-router-dom";
import type { WalletState } from "../hooks/useWallet";

interface HeaderProps {
  wallet: WalletState;
}

export function Header({ wallet }: HeaderProps) {
  const shortAddr = wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : null;

  return (
    <header className="header">
      <Link to="/" style={{ textDecoration: "none" }}>
        <div className="header-brand">
          <div className="header-logo" style={{ borderRadius: 0 }}>
            Z
          </div>
          <div>
            <div className="header-title" style={{ fontFamily: "Inter", letterSpacing: "-1px" }}>DAOnance</div>
            <div className="header-tagline" style={{ color: "var(--text-secondary)" }}>Powered by Zama</div>
          </div>
        </div>
      </Link>
      <div className="header-right">
        {wallet.address ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="wallet-address">{shortAddr}</span>
            <button className="btn btn-sm" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)" }} onClick={wallet.disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm wallet-btn" onClick={wallet.connect} disabled={wallet.isConnecting}>
            {wallet.isConnecting ? (
              <>
                <span className="spinner" /> Connecting…
              </>
            ) : (
              "Connect Wallet"
            )}
          </button>
        )}
      </div>
    </header>
  );
}
