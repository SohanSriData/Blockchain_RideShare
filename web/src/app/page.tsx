import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>A ride co-op owned by its drivers</h1>
      <p>
        Drivers stake a small refundable deposit to become members. Riders pay the fare into an on-chain escrow. When the
        ride is done, the contract pays the driver and sends a governed fee to a member-owned treasury. No company sits in
        the middle: the fee, the pricing and all treasury spending change only when members vote.
      </p>
      <h2>How it works</h2>
      <dl>
        <dt>Rider</dt>
        <dd>Pick pickup and drop-off on the map, offer a fare, cancel for a full refund any time before completion, confirm when served, then rate the driver.</dd>
        <dt>Driver</dt>
        <dd>Join with the fixed stake, accept open rides near you, get paid automatically, claim the fare if a rider never confirms after the timeout.</dd>
        <dt>Members</dt>
        <dd>Propose and vote on the fee, per-km rate, minimum fare, claim timeout and treasury spends. One member, one vote.</dd>
      </dl>
      <p className="row">
        <Link href="/rider">I need a ride</Link>
        <Link href="/driver">I drive</Link>
        <Link href="/governance">Governance</Link>
      </p>
      <p className="muted">
        Maps and distances are a convenience only. They never touch money: the contracts escrow exactly the fare the rider
        offers. Coordinates are published on-chain only to about 110 m.
      </p>
    </>
  );
}
