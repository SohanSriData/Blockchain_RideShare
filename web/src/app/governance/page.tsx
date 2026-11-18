"use client";

import { useState } from "react";
import { useConnection, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { isAddress, parseEther } from "viem";
import { TxButton } from "@/components/TxButton";
import { addresses, CHAIN_ID, governanceAbi, membershipAbi, PROPOSAL_KINDS } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";
import { eth, short } from "@/lib/format";
import { useIndexer, type ProposalView, type TreasuryView } from "@/lib/indexer";

const read = (functionName: "feePercent" | "FEE_CAP_PERCENT" | "perKmRate" | "minFare" | "claimTimeout" | "treasuryBalance") =>
  ({ chainId: CHAIN_ID, address: addresses.governance, abi: governanceAbi, functionName, query: { refetchInterval: 3000 } }) as const;

export default function GovernancePage() {
  const { address, isConnected } = useConnection();
  const fee = useReadContract(read("feePercent"));
  const cap = useReadContract(read("FEE_CAP_PERCENT"));
  const rate = useReadContract(read("perKmRate"));
  const minFare = useReadContract(read("minFare"));
  const timeout = useReadContract(read("claimTimeout"));
  const balance = useReadContract(read("treasuryBalance"));
  const member = useReadContract({ chainId: CHAIN_ID,
    address: addresses.membership,
    abi: membershipAbi,
    functionName: "isMember",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const proposals = useIndexer<ProposalView[]>("/proposals");
  const treasury = useIndexer<TreasuryView>("/treasury");
  const refresh = () => setTimeout(() => { proposals.refetch(); treasury.refetch(); balance.refetch(); fee.refetch(); rate.refetch(); minFare.refetch(); timeout.refetch(); }, 1500);

  return (
    <>
      <h1>Governance</h1>
      {!isConnected && <p className="notice">Connect your wallet to propose and vote.</p>}
      {isConnected && !member.data && <p className="notice">Only staked members can propose and vote. Join on the Driver page.</p>}
      {proposals.error && <p className="notice err">{proposals.error}</p>}

      <section>
        <h2>Current rules</h2>
        <dl>
          <dt>Fee</dt><dd>{fee.data?.toString() ?? "…"}% (cap {cap.data?.toString() ?? "…"}%)</dd>
          <dt>Per-km rate</dt><dd>{rate.data !== undefined ? eth(rate.data) : "…"}</dd>
          <dt>Minimum fare</dt><dd>{minFare.data !== undefined ? eth(minFare.data) : "…"}</dd>
          <dt>Claim timeout</dt><dd>{timeout.data !== undefined ? `${timeout.data} s` : "…"}</dd>
        </dl>
      </section>

      <section>
        <h2>Treasury: {balance.data !== undefined ? eth(balance.data) : "…"}</h2>
        <Deposit onDone={refresh} />
        {treasury.data?.history.length === 0 && <p className="muted">No treasury activity yet.</p>}
        {[...(treasury.data?.history ?? [])].reverse().map((h, i) => (
          <div key={i} className="card">
            <span>{h.type === "deposit" ? "Deposit from" : "Spend to"} <span className="mono">{short(h.counterparty)}</span></span>
            <span className={h.type === "deposit" ? "ok" : "err"}>{h.type === "deposit" ? "+" : "-"}{eth(h.amount)}</span>
          </div>
        ))}
      </section>

      <section>
        <h2>New proposal</h2>
        <NewProposal disabled={!member.data} onDone={refresh} />
      </section>

      <section>
        <h2>Proposals</h2>
        {proposals.data?.length === 0 && <p className="muted">No proposals yet.</p>}
        {[...(proposals.data ?? [])].reverse().map((p) => (
          <ProposalCard key={p.id} p={p} canVote={!!member.data} onDone={refresh} />
        ))}
      </section>
    </>
  );
}

function describe(p: ProposalView): string {
  const v = BigInt(p.value);
  switch (p.kind) {
    case "Fee": return `Set fee to ${v}%`;
    case "PerKmRate": return `Set per-km rate to ${eth(v)}`;
    case "MinFare": return `Set minimum fare to ${eth(v)}`;
    case "ClaimTimeout": return `Set claim timeout to ${v} s`;
    case "Spend": return `Spend ${eth(v)} to ${short(p.recipient ?? "")}`;
  }
}

function ProposalCard({ p, canVote, onDone }: { p: ProposalView; canVote: boolean; onDone: () => void }) {
  const { address } = useConnection();
  const voted = useReadContract({ chainId: CHAIN_ID,
    address: addresses.governance,
    abi: governanceAbi,
    functionName: "hasVoted",
    args: [BigInt(p.id), address!],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const req = (functionName: "vote" | "execute", args: readonly unknown[]) => ({ address: addresses.governance, abi: governanceAbi, functionName, args });
  return (
    <div className="card">
      <span>
        <strong>#{p.id}</strong> {describe(p)}
        <br />
        <small className="muted">
          {p.status} · for {p.forVotes} / against {p.againstVotes} · quorum {p.quorum} · ends {new Date(p.endTime * 1000).toLocaleTimeString()}
        </small>
      </span>
      <span className="row">
        {p.status === "open" && canVote && !voted.data && (
          <>
            <TxButton label="Vote for" request={req("vote", [BigInt(p.id), true])} onDone={() => { voted.refetch(); onDone(); }} />
            <TxButton label="Vote against" className="ghost" request={req("vote", [BigInt(p.id), false])} onDone={() => { voted.refetch(); onDone(); }} />
          </>
        )}
        {p.status === "open" && voted.data && <small className="muted">You voted.</small>}
        {p.status === "passed" && <TxButton label="Execute" request={req("execute", [BigInt(p.id)])} onDone={onDone} />}
      </span>
    </div>
  );
}

function NewProposal({ disabled, onDone }: { disabled: boolean; onDone: () => void }) {
  const [kind, setKind] = useState(0);
  const [value, setValue] = useState("");
  const [recipient, setRecipient] = useState("");
  const isEth = kind === 1 || kind === 2 || kind === 4;
  const unit = ["percent", "ETH per km", "ETH", "seconds", "ETH"][kind];

  let wei: bigint | undefined;
  try {
    wei = value ? (isEth ? parseEther(value) : BigInt(value)) : undefined;
  } catch {
    wei = undefined;
  }
  const badRecipient = kind === 4 && !isAddress(recipient);
  return (
    <div className="row">
      <select value={kind} onChange={(e) => setKind(Number(e.target.value))} aria-label="Proposal type">
        {PROPOSAL_KINDS.map((k, i) => <option key={k} value={i}>{k}</option>)}
      </select>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Value (${unit})`} inputMode="decimal" aria-label="Value" />
      {kind === 4 && <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient 0x…" aria-label="Recipient" />}
      <TxButton
        label="Propose"
        disabled={disabled || wei === undefined || badRecipient}
        request={{
          address: addresses.governance,
          abi: governanceAbi,
          functionName: "propose",
          args: [kind, wei ?? 0n, kind === 4 ? recipient : "0x0000000000000000000000000000000000000000"],
        }}
        onDone={onDone}
      />
    </div>
  );
}

function Deposit({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const send = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash: send.data, chainId: CHAIN_ID });
  let wei: bigint | undefined;
  try {
    wei = amount ? parseEther(amount) : undefined;
  } catch {
    wei = undefined;
  }
  return (
    <p className="row">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Deposit (ETH)" inputMode="decimal" aria-label="Deposit amount" />
      <button
        className="ghost"
        disabled={!wei || send.isPending}
        onClick={() => send.mutate({ to: addresses.governance, value: wei, chainId: CHAIN_ID },{ onSuccess: () => setTimeout(onDone, 1500) })}
      >
        Donate to treasury
      </button>
      {receipt.isLoading && <small className="muted">Pending…</small>}
      {receipt.isSuccess && <small className="ok">Confirmed</small>}
      {send.error && <small className="err">{friendlyError(send.error)}</small>}
    </p>
  );
}
