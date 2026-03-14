import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Contract } from "ethers";

interface CreateProposalProps {
  contract: Contract | null;
  address: string | null;
}

export function CreateProposal({ contract, address }: CreateProposalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("1");
  const [voteLimit, setVoteLimit] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contract || !address) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const durationSeconds = parseInt(durationMinutes) * 60;
      if (isNaN(durationSeconds) || durationSeconds <= 0) {
        throw new Error("Please enter a valid duration in minutes.");
      }
      
      const tx = await contract.createProposal(title, description, durationSeconds, parseInt(voteLimit));
      await tx.wait();
      navigate("/");
    } catch (err: any) {
      console.error(err);
      
      // Handle insufficient funds specifically
      const errorMessage = err?.message?.toLowerCase() || "";
      if (errorMessage.includes("insufficient funds") || err?.code === "INSUFFICIENT_FUNDS" || err?.error?.message?.includes("insufficient funds")) {
        setError("You don't have enough SepoliaETH to cover the transaction gas fee. Please get some from a faucet.");
      } else if (errorMessage.includes("user rejected")) {
        setError("Transaction was rejected in your wallet.");
      } else {
        setError("Transaction failed. Please check your wallet for details or try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!address) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔐</div>
        <h3 className="empty-state-title">Connect your wallet</h3>
        <p className="empty-state-desc">You need to connect your wallet to create a proposal</p>
      </div>
    );
  }

  return (
    <div>
      <div className="detail-back" onClick={() => navigate("/")}>
        ← Back to proposals
      </div>

      <h1 className="page-title" style={{ marginBottom: 8 }}>
        New Proposal
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 32 }}>
        Create a governance proposal with encrypted voting
      </p>

      <form className="create-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Title</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. Increase staking rewards to 12%"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">Description</label>
          <textarea
            className="input textarea"
            placeholder="Describe the proposal in detail…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="create-form-row">
          <div className="input-group">
            <label className="input-label">Voting Duration (Minutes)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="1440"
              placeholder="e.g. 1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Vote Limit</label>
            <input
              className="input"
              type="number"
              min="1"
              max="10000"
              placeholder="1"
              value={voteLimit}
              onChange={(e) => setVoteLimit(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <div className="status-msg status-msg-error">{error}</div>}

        <button
          className="btn btn-primary btn-lg btn-block"
          type="submit"
          disabled={isSubmitting || !title || !description}
        >
          {isSubmitting ? (
            <>
              <span className="spinner" /> Creating proposal…
            </>
          ) : (
            "Create Proposal"
          )}
        </button>
      </form>
    </div>
  );
}
