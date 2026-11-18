import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="hero">
        <h1>A ride co-op owned by its drivers</h1>
        <p>
          Riders pay the fare into an on-chain escrow. When the ride is done, the contract pays the driver and sends a
          governed fee to a member-owned treasury. No company sits in the middle: the fee, the pricing and all treasury
          spending change only when members vote.
        </p>
      </div>

      <div className="choices">
        <Link href="/rider" className="panel choice role-rider">
          <h2>I need a ride →</h2>
          <p className="muted">
            Pick pickup and drop-off on the map and offer a fare. Cancel for a full refund any time before completion,
            confirm when served, then rate the driver.
          </p>
        </Link>
        <Link href="/driver" className="panel choice role-driver">
          <h2>I drive →</h2>
          <p className="muted">
            Join with a refundable stake, accept open rides near you and get paid automatically. Claim the fare if a rider
            never confirms after the timeout.
          </p>
        </Link>
      </div>

      <Link href="/governance" className="panel choice role-gov" style={{ display: "block", marginBottom: 24 }}>
        <h2>Governance →</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Members propose and vote on the fee, per-km rate, minimum fare, claim timeout and treasury spends. One member,
          one vote.
        </p>
      </Link>

      <p className="muted">
        Maps and distances are a convenience only. They never touch money: the contracts escrow exactly the fare the rider
        offers. Coordinates are published on-chain only to about 110 m.
      </p>
    </>
  );
}
