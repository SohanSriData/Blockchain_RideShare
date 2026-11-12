import { parseAbi, type Abi, type Address } from "viem";
import deployment from "./deployment.json";

/** Addresses come from configuration generated at local deployment (`npm run sync:deployment`). */
export const addresses = {
  membership: deployment.membership as Address,
  governance: deployment.governance as Address,
  rideServices: deployment.rideServices as Address,
  reputation: deployment.reputation as Address,
};

export const CHAIN_ID = deployment.chainId;

export const membershipAbi = parseAbi([
  "function STAKE() view returns (uint256)",
  "function isMember(address) view returns (bool)",
  "function memberCount() view returns (uint256)",
  "function activeRides(address) view returns (uint256)",
  "function join() payable",
  "function exit()",
  "error WrongStake()",
  "error AlreadyMember()",
  "error NotMember()",
  "error RideInProgress()",
]);

export const rideAbi = parseAbi([
  "function requestRide(int256 pickupLat, int256 pickupLng, int256 dropLat, int256 dropLng) payable returns (uint256)",
  "function acceptRide(uint256 id)",
  "function cancelRide(uint256 id)",
  "function completeRide(uint256 id)",
  "function claimFare(uint256 id)",
  "function getRide(uint256 id) view returns (address rider, address driver, uint256 fare, uint8 status, uint256 claimableAt)",
  "error FareBelowMinimum()",
  "error BadCoordinates()",
  "error NotMember()",
  "error WrongStatus()",
  "error SelfDealing()",
  "error NotRider()",
  "error NotDriver()",
  "error ClaimTooEarly()",
]);

export const reputationAbi = parseAbi([
  "function rate(uint256 rideId, uint8 score)",
  "function hasRated(uint256 rideId, address rater) view returns (bool)",
  "error BadScore()",
  "error RideNotCompleted()",
  "error NotParticipant()",
  "error AlreadyRated()",
]);

export const governanceAbi = parseAbi([
  "function feePercent() view returns (uint256)",
  "function FEE_CAP_PERCENT() view returns (uint256)",
  "function perKmRate() view returns (uint256)",
  "function minFare() view returns (uint256)",
  "function claimTimeout() view returns (uint256)",
  "function treasuryBalance() view returns (uint256)",
  "function hasVoted(uint256 id, address voter) view returns (bool)",
  "function propose(uint8 kind, uint256 value, address recipient) returns (uint256)",
  "function vote(uint256 id, bool support)",
  "function execute(uint256 id)",
  "error NotMember()",
  "error NotEligible()",
  "error FeeAboveCap()",
  "error UnknownProposal()",
  "error VotingClosed()",
  "error VotingStillOpen()",
  "error AlreadyVoted()",
  "error AlreadyExecuted()",
  "error NotPassed()",
  "error InsufficientTreasury()",
  "error BadRecipient()",
]);

export const RIDE_STATUS = ["None", "Requested", "Accepted", "Completed", "Cancelled"] as const;
export const PROPOSAL_KINDS = ["Fee", "PerKmRate", "MinFare", "ClaimTimeout", "Spend"] as const;

export type TxRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};
