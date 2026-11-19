import type { RideView } from "@/lib/indexer";

const STEPS = ["Requested", "Accepted", "Completed"] as const;

const HINTS: Record<"rider" | "driver", Record<RideView["status"], string>> = {
  rider: {
    Requested: "Waiting for a driver to accept. Your fare is held in escrow; cancel any time for a full refund.",
    Accepted: "A driver is on the way. Confirm completion once you have arrived to release the fare.",
    Completed: "Done. The driver was paid from escrow and the co-op fee went to the treasury.",
    Cancelled: "Cancelled. The full fare was refunded to you.",
  },
  driver: {
    Requested: "Open for drivers.",
    Accepted: "Drive to the pickup. You are paid when the rider confirms, or claim after the timeout.",
    Completed: "Paid. The co-op fee went to the treasury.",
    Cancelled: "Cancelled by the rider. Do not drive to this pickup.",
  },
};

/** Step indicator for a ride: Requested, Accepted, Completed (or Cancelled), with a "what happens next" hint. */
export function RideTracker({ status, who }: { status: RideView["status"]; who: "rider" | "driver" }) {
  const cancelled = status === "Cancelled";
  // A cancelled ride stopped after Requested or Accepted; the indexer only keeps the final status, so show it at step 2.
  const reached = cancelled ? 1 : STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <div>
      <div className={`tracker${cancelled ? " cancelled" : ""}`} aria-label={`Ride status: ${status}`}>
        {STEPS.map((label, i) => {
          // A cancelled ride was still requested, so step 1 stays ticked; the Cancelled step is the current one.
          const done = cancelled ? i < reached : i < reached || (i === reached && status === "Completed");
          const current = i === reached && !done;
          const text = cancelled && i === reached ? "Cancelled" : label;
          return (
            <span key={label} style={{ display: "contents" }}>
              {i > 0 && <span className={`bar${!cancelled && i <= reached ? " done" : ""}`} />}
              <span className={`step${done ? " done" : ""}${current ? " current" : ""}`}>
                <span className="bubble">{cancelled && i === reached ? "×" : done ? "✓" : i + 1}</span>
                <span className={cancelled && i === reached ? "err" : undefined}>{text}</span>
              </span>
            </span>
          );
        })}
      </div>
      <p className="tracker-hint">{HINTS[who][status]}</p>
    </div>
  );
}
