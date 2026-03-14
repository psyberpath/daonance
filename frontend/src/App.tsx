import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { CreateProposal } from "./pages/CreateProposal";
import { ProposalDetail } from "./pages/ProposalDetail";

export default function App() {
  const wallet = useWallet();

  return (
    <BrowserRouter>
      <div className="app-container">
        <Header wallet={wallet} />

        <main style={{ flex: 1, paddingBottom: 40 }}>
          <Routes>
            <Route path="/" element={<Home contract={wallet.contract} address={wallet.address} />} />
            <Route path="/create" element={<CreateProposal contract={wallet.contract} address={wallet.address} />} />
            <Route
              path="/proposal/:id"
              element={<ProposalDetail contract={wallet.contract} address={wallet.address} />}
            />
          </Routes>
        </main>

        <footer className="footer">
          <span>DAOnance · Private Governance</span>
          <span>Powered by Zama fhEVM</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
