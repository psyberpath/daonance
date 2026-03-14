import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Contract } from "ethers";
import { type Proposal, getStatus, formatTimeLeft, shortAddress } from "../utils/helpers";
import { encryptVote } from "../utils/fheEncryption";

interface ProposalDetailProps {
  contract: Contract | null;
  address: string | null;
}

const statusConfig = {
  active: { className: "badge-active", label: "Active" },
  pending: { className: "badge-pending", label: "Pending Reveal" },
  revealed: { className: "badge-revealed", label: "Revealed" },
  closed: { className: "badge-closed", label: "Closed" },
};

export function ProposalDetail({ contract, address }: ProposalDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [msg, setMsg] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const loadProposal = useCallback(async () => {
    if (!contract || !id) return;
    setLoading(true);
    try {
      const p = await contract.getProposal(parseInt(id));
      const prop: Proposal = {
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
      };
      setProposal(prop);

      if (address) {
        const voted = await contract.hasVoted(parseInt(id), address);
        setHasVoted(voted);
      }
    } catch (err) {
      console.error("Failed to load proposal:", err);
    } finally {
      setLoading(false);
    }
  }, [contract, id, address]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  // Live countdown timer
  useEffect(() => {
    if (!proposal) return;
    const update = () => setTimeLeft(formatTimeLeft(proposal.deadline));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal]);

  async function handleVote(isYes: boolean) {
    if (!contract || !address || !proposal) return;
    setVoting(true);
    setMsg(null);
    try {
      const voteValue = isYes ? 1 : 0;
      setMsg({ type: "info", text: "🔐 Encrypting your vote with FHE…" });

      // Use real FHE encryption via the SDK
      const { encryptedHandle, inputProof } = await encryptVote(
        voteValue,
        "0xf511B527619C74d79c869208e5F3CEE47F971670", // CONTRACT_ADDRESS from contract.ts
        address,
      );

      const tx = await contract.castVote(proposal.id, encryptedHandle, inputProof);
      await tx.wait();

      setHasVoted(true);
      setMsg({ type: "success", text: "✓ Vote cast successfully! Your vote is encrypted on-chain." });
      await loadProposal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Vote failed";
      // Show a cleaner error for common cases
      if (message.includes("already voted")) {
        setMsg({ type: "error", text: "You have already voted on this proposal." });
      } else if (message.includes("voting ended")) {
        setMsg({ type: "error", text: "Voting period has ended." });
      } else {
        setMsg({ type: "error", text: "Vote transaction failed. Check console for details." });
        console.error(err);
      }
    } finally {
      setVoting(false);
    }
  }

  async function handleRequestReveal() {
    if (!contract || !proposal) return;
    setRevealing(true);
    setMsg(null);
    try {
      const tx = await contract.requestReveal(proposal.id);
      await tx.wait();
      setMsg({ type: "success", text: "✓ Reveal requested! Encrypted tallies are now publicly decryptable." });
      await loadProposal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reveal failed";
      if (message.includes("only creator")) {
        setMsg({ type: "error", text: "Only the proposal creator can request reveal." });
      } else if (message.includes("voting still open")) {
        setMsg({ type: "error", text: "Voting is still open. Wait for the deadline." });
      } else {
        setMsg({ type: "error", text: "Reveal request failed." });
        console.error(err);
      }
    } finally {
      setRevealing(false);
    }
  }

  if (loading || !proposal) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: "0 auto 16px", width: 28, height: 28, borderWidth: 3 }} />
        <p className="empty-state-desc">Loading proposal…</p>
      </div>
    );
  }

  const status = getStatus(proposal);
  const config = statusConfig[status];
  const isCreator = address?.toLowerCase() === proposal.creator.toLowerCase();
  const totalVotes = proposal.revealedYesCount + proposal.revealedNoCount;
  const yesPercent = totalVotes > 0 ? (proposal.revealedYesCount / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (proposal.revealedNoCount / totalVotes) * 100 : 0;

  return (
    <div>
      <div className="detail-back" onClick={() => navigate("/")}>
        ← Back to proposals
      </div>

      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className={`badge ${config.className}`}>
            <span className="badge-dot" />
            {config.label}
          </span>
          {status === "active" && <span className="countdown countdown-live">{timeLeft}</span>}
        </div>
        <h1 className="detail-title">{proposal.title}</h1>
        <p className="detail-desc">{proposal.description}</p>

        <div className="detail-meta">
          <div className="detail-meta-item">
            <span className="detail-meta-label">Creator</span>
            <span className="detail-meta-value">{shortAddress(proposal.creator)}</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-label">Votes Cast</span>
            <span className="detail-meta-value">
              {proposal.voteCount} / {proposal.voteLimit}
            </span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-label">Deadline</span>
            <span className="detail-meta-value">{new Date(proposal.deadline * 1000).toLocaleString()}</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-label">Privacy</span>
            <span className="encrypted-badge">🔒 FHE Encrypted</span>
          </div>
        </div>
      </div>

      {/* Status messages */}
      {msg && (
        <div className={`status-msg status-msg-${msg.type}`} style={{ marginBottom: 24 }}>
          {msg.text}
        </div>
      )}

      {/* Voting Section — only when active */}
      {status === "active" && address && (
        <div className="vote-section">
          <h2 className="vote-section-title">Cast Your Vote</h2>
          {hasVoted ? (
            <div className="status-msg status-msg-info">
              ✓ You have already voted on this proposal. Your vote is encrypted.
            </div>
          ) : (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
                Your vote will be encrypted using Fully Homomorphic Encryption. Nobody — not even the contract — can see
                how you voted.
              </p>
              <div className="vote-buttons">
                <button className="vote-btn vote-btn-yes" onClick={() => handleVote(true)} disabled={voting}>
                  {voting ? (
                    <span className="spinner" style={{ color: "var(--green)" }} />
                  ) : (
                    <span className="vote-btn-icon">👍</span>
                  )}
                  <span className="vote-btn-label">Vote Yes</span>
                  <span className="vote-btn-sub">Encrypted with FHE</span>
                </button>
                <button className="vote-btn vote-btn-no" onClick={() => handleVote(false)} disabled={voting}>
                  {voting ? (
                    <span className="spinner" style={{ color: "var(--red)" }} />
                  ) : (
                    <span className="vote-btn-icon">👎</span>
                  )}
                  <span className="vote-btn-label">Vote No</span>
                  <span className="vote-btn-sub">Encrypted with FHE</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Not connected */}
      {status === "active" && !address && (
        <div className="status-msg status-msg-warning" style={{ marginBottom: 24 }}>
          Connect your wallet to vote on this proposal.
        </div>
      )}

      {/* Reveal Section — pending state, creator only */}
      {status === "pending" && isCreator && (
        <div className="reveal-section">
          <h3 className="reveal-section-title">Reveal Results</h3>
          <p className="reveal-section-desc">
            Voting has ended. As the proposal creator, you can request the encrypted tallies to be revealed. This will
            mark them as publicly decryptable so anyone can verify the results.
          </p>
          <button className="btn btn-primary" onClick={handleRequestReveal} disabled={revealing}>
            {revealing ? (
              <>
                <span className="spinner" /> Requesting reveal…
              </>
            ) : (
              "Request Reveal"
            )}
          </button>
        </div>
      )}

      {status === "pending" && !isCreator && (
        <div className="reveal-section">
          <h3 className="reveal-section-title">Awaiting Reveal</h3>
          <p className="reveal-section-desc">
            Voting has ended. The proposal creator needs to request the reveal of encrypted tallies. Results are still
            encrypted on-chain.
          </p>
          <div className="encrypted-badge" style={{ display: "inline-flex" }}>
            🔒 Tallies are still encrypted
          </div>
        </div>
      )}

      {/* Results Section — revealed state */}
      {status === "revealed" && (
        <div className="results-section">
          <h2 className="vote-section-title" style={{ marginBottom: 20 }}>
            Results
          </h2>
          <div className="results-bars">
            <div className="result-row">
              <div className="result-label-row">
                <span className="result-label">👍 Yes</span>
                <span className="result-count" style={{ color: "var(--green)" }}>
                  {proposal.revealedYesCount} votes ({yesPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="result-bar-track">
                <div className="result-bar-fill result-bar-fill-yes" style={{ width: `${yesPercent}%` }} />
              </div>
            </div>
            <div className="result-row">
              <div className="result-label-row">
                <span className="result-label">👎 No</span>
                <span className="result-count" style={{ color: "var(--red)" }}>
                  {proposal.revealedNoCount} votes ({noPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="result-bar-track">
                <div className="result-bar-fill result-bar-fill-no" style={{ width: `${noPercent}%` }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
            Total votes: {totalVotes} · Verified via FHE.checkSignatures
          </div>
        </div>
      )}
    </div>
  );
}
