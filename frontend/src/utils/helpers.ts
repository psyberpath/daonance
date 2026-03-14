export interface Proposal {
  id: number;
  title: string;
  description: string;
  creator: string;
  deadline: number;
  voteCount: number;
  voteLimit: number;
  revealed: boolean;
  revealedYesCount: number;
  revealedNoCount: number;
}

export function getStatus(p: Proposal): "active" | "pending" | "revealed" | "closed" {
  if (p.revealed) return "revealed";
  const now = Math.floor(Date.now() / 1000);
  if (now < p.deadline) return "active";
  return "pending";
}

export function formatTimeLeft(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
