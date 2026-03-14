import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Contract } from "ethers";
import { type Proposal, getStatus, formatTimeLeft, shortAddress } from "../utils/helpers";

interface HomeProps {
  contract: Contract | null;
  address: string | null;
}

const statusConfig = {
  active: { className: "badge-active", label: "Active" },
  pending: { className: "badge-pending", label: "Pending Reveal" },
  revealed: { className: "badge-revealed", label: "Revealed" },
  closed: { className: "badge-closed", label: "Closed" },
};

export function Home({ contract, address }: HomeProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProposals = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = await contract.proposalCount();
      const n = Number(count);
      const items: Proposal[] = [];
      for (let i = n - 1; i >= 0; i--) {
        const p = await contract.getProposal(i);
        items.push({
          id: Number(p.id),
          title: p.title,
          description: p.description,
          creator: p.creator,
          deadline: Number(p.deadline),
          voteCount: Number(p.voteCount),
          voteLimit: Number(p.voteLimit),
          revealed: p.revealed,
          revealedYesCount: Number(p.revealedYesCount),
          revealedNoCount: Number(p.revealedNoCount),
        });
      }
      setProposals(items);
    } catch (err) {
      console.error("Failed to load proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Proposals</h1>
        {address && (
          <Link to="/create" className="btn btn-primary">
            + New Proposal
          </Link>
        )}
      </div>

      {!contract && (
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <h3 className="empty-state-title">Connect your wallet</h3>
          <p className="empty-state-desc">Connect MetaMask to view and vote on proposals</p>
        </div>
      )}

      {contract && loading && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: "0 auto 16px", width: 28, height: 28, borderWidth: 3 }} />
          <p className="empty-state-desc">Loading proposals…</p>
        </div>
      )}

      {contract && !loading && proposals.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 className="empty-state-title">No proposals yet</h3>
          <p className="empty-state-desc">Be the first to create a governance proposal</p>
          <Link to="/create" className="btn btn-primary">
            Create Proposal
          </Link>
        </div>
      )}

      {proposals.length > 0 && (
        <div className="proposals-list">
          {proposals.map((p) => {
            const status = getStatus(p);
            const config = statusConfig[status];
            return (
              <Link to={`/proposal/${p.id}`} key={p.id} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="card card-clickable proposal-card">
                  <div className="proposal-card-header">
                    <h3 className="proposal-card-title">{p.title}</h3>
                    <span className={`badge ${config.className}`}>
                      <span className="badge-dot" />
                      {config.label}
                    </span>
                  </div>
                  <p className="proposal-card-desc">{p.description}</p>
                  <div className="proposal-card-meta">
                    <span>👤 {shortAddress(p.creator)}</span>
                    <span>
                      🗳️ {p.voteCount}/{p.voteLimit} votes
                    </span>
                    <span>
                      ⏱️{" "}
                      {status === "active" ? (
                        <span className="countdown-live">{formatTimeLeft(p.deadline)}</span>
                      ) : status === "revealed" ? (
                        `Yes: ${p.revealedYesCount} · No: ${p.revealedNoCount}`
                      ) : (
                        "Ended"
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
