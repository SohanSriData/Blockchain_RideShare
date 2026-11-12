const MESSAGES: Record<string, string> = {
  WrongStake: "Wrong stake amount. Send exactly the stake shown.",
  AlreadyMember: "This address is already a member.",
  NotMember: "Only staked members can do this. Join the co-op first.",
  NotEligible: "You are not eligible to vote on this proposal (you must have joined before it was created).",
  RideInProgress: "You have a ride in progress. Finish it before leaving the co-op.",
  FareBelowMinimum: "The fare is below the governed minimum fare.",
  BadCoordinates: "Pickup or drop-off coordinates are out of range.",
  WrongStatus: "This ride is not in a state that allows this action.",
  SelfDealing: "You cannot accept a ride you requested yourself.",
  NotRider: "Only the rider of this ride can do this.",
  NotDriver: "Only the driver of this ride can do this.",
  ClaimTooEarly: "The claim timeout has not elapsed yet.",
  RideNotCompleted: "A ride can be rated only after it is completed.",
  NotParticipant: "Only the rider or driver of this ride can rate it.",
  AlreadyRated: "You already rated this ride.",
  BadScore: "Ratings must be between 1 and 5.",
  FeeAboveCap: "The fee cannot exceed the cap.",
  AlreadyVoted: "You already voted on this proposal.",
  VotingClosed: "Voting on this proposal has ended.",
  VotingStillOpen: "Voting is still open. Execute after it ends.",
  AlreadyExecuted: "This proposal was already executed.",
  NotPassed: "This proposal did not pass (quorum or majority missing).",
  InsufficientTreasury: "The treasury does not hold enough to pay this spend.",
  UnknownProposal: "That proposal does not exist.",
  BadRecipient: "A spend proposal needs a recipient address.",
};

/** Turn a wallet/viem error into a sentence a rider or driver can act on. */
export function friendlyError(err: unknown): string {
  const text = err instanceof Error ? `${err.message} ${(err as { shortMessage?: string }).shortMessage ?? ""}` : String(err);
  if (/user rejected|user denied/i.test(text)) return "You rejected the request in your wallet.";
  for (const [name, msg] of Object.entries(MESSAGES)) {
    if (text.includes(`${name}(`) || text.includes(`"${name}"`) || new RegExp(`\\b${name}\\b`).test(text)) return msg;
  }
  if (/insufficient funds/i.test(text)) return "Your wallet does not have enough ETH for this transaction.";
  return text.trim().slice(0, 200);
}
