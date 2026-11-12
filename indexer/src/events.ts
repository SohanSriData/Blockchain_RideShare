import { parseAbi } from "viem";

/** Event ABIs of the four contracts. The indexer reads only these; it never calls a write function. */
export const eventAbi = parseAbi([
  // Membership
  "event MemberJoined(address indexed member, uint256 stake)",
  "event MemberExited(address indexed member, uint256 stake)",
  // RideServices
  "event RideRequested(uint256 indexed id, address indexed rider, uint256 fare, int32 pickupLat, int32 pickupLng, int32 dropLat, int32 dropLng)",
  "event RideAccepted(uint256 indexed id, address indexed driver)",
  "event RideCancelled(uint256 indexed id, address indexed rider, address indexed driver, uint256 refund)",
  "event RideCompleted(uint256 indexed id, address indexed rider, address indexed driver, bool claimed)",
  "event FareSplit(uint256 indexed id, address indexed driver, uint256 driverAmount, uint256 fee)",
  // Reputation (role: 0 = driver profile, 1 = rider profile)
  "event RatingSubmitted(uint256 indexed rideId, address indexed rater, address indexed ratee, uint8 role, uint8 score)",
  // Governance (kind: 0 Fee, 1 PerKmRate, 2 MinFare, 3 ClaimTimeout, 4 Spend)
  "event ProposalCreated(uint256 indexed id, address indexed proposer, uint8 kind, uint256 value, address recipient, uint256 endTime, uint256 quorum)",
  "event VoteCast(uint256 indexed id, address indexed voter, bool support)",
  "event ProposalExecuted(uint256 indexed id)",
  "event ParameterChanged(uint8 indexed kind, uint256 value)",
  "event TreasuryDeposit(address indexed from, uint256 amount)",
  "event TreasurySpend(uint256 indexed proposalId, address indexed to, uint256 amount)",
]);

export const KIND_NAMES = ["Fee", "PerKmRate", "MinFare", "ClaimTimeout", "Spend"] as const;

/** A decoded contract event in chain order. */
export interface IndexedEvent {
  name: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
}
