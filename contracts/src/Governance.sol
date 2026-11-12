// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Membership} from "./Membership.sol";

/// @notice Treasury plus member governance. All parameters change only by an executed proposal.
contract Governance {
    enum Kind {
        Fee,
        PerKmRate,
        MinFare,
        ClaimTimeout,
        Spend
    }

    struct Proposal {
        Kind kind;
        bool executed;
        address recipient;
        uint256 value;
        uint256 endTime;
        uint256 snapshotSeq; // Membership.joinCounter at creation; later joiners are ineligible
        uint256 quorum; // fixed from the member count at creation
        uint256 forVotes;
        uint256 againstVotes;
    }

    Membership public immutable MEMBERSHIP;
    uint256 public immutable FEE_CAP_PERCENT;
    uint256 public immutable QUORUM_PERCENT;
    uint256 public immutable VOTING_PERIOD;

    uint256 public feePercent;
    uint256 public perKmRate; // wei per km, read by the app; never verified on-chain
    uint256 public minFare;
    uint256 public claimTimeout;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed id, address indexed proposer, Kind kind, uint256 value, address recipient, uint256 endTime,
        uint256 quorum
    );
    event VoteCast(uint256 indexed id, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id);
    event ParameterChanged(Kind indexed kind, uint256 value);
    event TreasuryDeposit(address indexed from, uint256 amount);
    event TreasurySpend(uint256 indexed proposalId, address indexed to, uint256 amount);

    error NotMember();
    error NotEligible();
    error FeeAboveCap();
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error AlreadyExecuted();
    error NotPassed();
    error InsufficientTreasury();
    error BadRecipient();
    error TransferFailed();

    constructor(
        Membership membership,
        uint256 initialFeePercent,
        uint256 feeCapPercent,
        uint256 quorumPercent,
        uint256 votingPeriod,
        uint256 initialPerKmRate,
        uint256 initialMinFare,
        uint256 initialClaimTimeout
    ) {
        if (initialFeePercent > feeCapPercent) revert FeeAboveCap();
        MEMBERSHIP = membership;
        FEE_CAP_PERCENT = feeCapPercent;
        QUORUM_PERCENT = quorumPercent;
        VOTING_PERIOD = votingPeriod;
        feePercent = initialFeePercent;
        perKmRate = initialPerKmRate;
        minFare = initialMinFare;
        claimTimeout = initialClaimTimeout;
    }

    receive() external payable {
        emit TreasuryDeposit(msg.sender, msg.value);
    }

    function treasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Quorum for a given member count: percentage rounded up, never below 1 vote.
    function quorumFor(uint256 memberCount) public view returns (uint256 q) {
        q = (memberCount * QUORUM_PERCENT + 99) / 100;
        if (q == 0) q = 1;
    }

    function propose(Kind kind, uint256 value, address recipient) external returns (uint256 id) {
        if (!MEMBERSHIP.isMember(msg.sender)) revert NotMember();
        if (kind == Kind.Fee && value > FEE_CAP_PERCENT) revert FeeAboveCap();
        if (kind == Kind.Spend && recipient == address(0)) revert BadRecipient();
        id = ++proposalCount;
        Proposal storage p = proposals[id];
        p.kind = kind;
        p.value = value;
        p.recipient = recipient;
        p.endTime = block.timestamp + VOTING_PERIOD;
        p.snapshotSeq = MEMBERSHIP.joinCounter();
        p.quorum = quorumFor(MEMBERSHIP.memberCount());
        emit ProposalCreated(id, msg.sender, kind, value, recipient, p.endTime, p.quorum);
    }

    function vote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];
        if (id == 0 || id > proposalCount) revert UnknownProposal();
        if (block.timestamp >= p.endTime) revert VotingClosed();
        uint256 seq = MEMBERSHIP.joinSeq(msg.sender);
        if (!MEMBERSHIP.isMember(msg.sender) || seq == 0 || seq > p.snapshotSeq) revert NotEligible();
        if (hasVoted[id][msg.sender]) revert AlreadyVoted();
        hasVoted[id][msg.sender] = true;
        if (support) p.forVotes++;
        else p.againstVotes++;
        emit VoteCast(id, msg.sender, support);
    }

    function passed(uint256 id) public view returns (bool) {
        Proposal storage p = proposals[id];
        return p.forVotes + p.againstVotes >= p.quorum && p.forVotes > p.againstVotes;
    }

    /// @notice Anyone may execute a passed proposal once voting has ended.
    function execute(uint256 id) external {
        if (id == 0 || id > proposalCount) revert UnknownProposal();
        Proposal storage p = proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp < p.endTime) revert VotingStillOpen();
        if (!passed(id)) revert NotPassed();
        p.executed = true; // effects before interactions

        Kind kind = p.kind;
        uint256 value = p.value;
        if (kind == Kind.Spend) {
            if (value > address(this).balance) revert InsufficientTreasury();
            emit TreasurySpend(id, p.recipient, value);
            emit ProposalExecuted(id);
            (bool ok,) = p.recipient.call{value: value}("");
            if (!ok) revert TransferFailed();
            return;
        }
        if (kind == Kind.Fee) feePercent = value;
        else if (kind == Kind.PerKmRate) perKmRate = value;
        else if (kind == Kind.MinFare) minFare = value;
        else claimTimeout = value;
        emit ParameterChanged(kind, value);
        emit ProposalExecuted(id);
    }
}
