// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Membership} from "../src/Membership.sol";
import {Governance} from "../src/Governance.sol";

contract GovernanceTest is Test {
    Membership m;
    Governance g;
    address outsider = makeAddr("outsider");
    address recipient = makeAddr("recipient");
    address[] members;
    uint256 constant STAKE = 0.01 ether;
    uint256 constant PERIOD = 1 minutes;

    event ProposalCreated(
        uint256 indexed id, address indexed proposer, Governance.Kind kind, uint256 value, address recipient,
        uint256 endTime, uint256 quorum
    );
    event VoteCast(uint256 indexed id, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id);
    event ParameterChanged(Governance.Kind indexed kind, uint256 value);
    event TreasuryDeposit(address indexed from, uint256 amount);
    event TreasurySpend(uint256 indexed proposalId, address indexed to, uint256 amount);

    function setUp() public {
        m = new Membership(STAKE, address(0xBEEF));
        g = new Governance(m, 5, 20, 20, PERIOD, 0.001 ether, 0.002 ether, 30 minutes);
    }

    function _join(uint256 n) internal {
        for (uint256 i; i < n; i++) {
            address a = makeAddr(string.concat("member", vm.toString(members.length)));
            vm.deal(a, 1 ether);
            vm.prank(a);
            m.join{value: STAKE}();
            members.push(a);
        }
    }

    function _propose(Governance.Kind k, uint256 v) internal returns (uint256 id) {
        vm.prank(members[0]);
        id = g.propose(k, v, address(0));
    }

    function _vote(uint256 id, uint256 from, uint256 to, bool support) internal {
        for (uint256 i = from; i < to; i++) {
            vm.prank(members[i]);
            g.vote(id, support);
        }
    }

    function _finish() internal {
        vm.warp(block.timestamp + PERIOD);
    }

    // ---- defaults ----

    function test_initial_parameters() public view {
        assertEq(g.feePercent(), 5);
        assertEq(g.FEE_CAP_PERCENT(), 20);
        assertEq(g.perKmRate(), 0.001 ether);
        assertEq(g.minFare(), 0.002 ether);
        assertEq(g.claimTimeout(), 30 minutes);
    }

    // ---- fee change only through passed proposal ----

    function test_fee_changes_through_passed_proposal() public {
        _join(5);
        uint256 id = _propose(Governance.Kind.Fee, 8);
        _vote(id, 0, 3, true);
        _finish();
        vm.expectEmit(true, false, false, true);
        emit ParameterChanged(Governance.Kind.Fee, 8);
        vm.expectEmit(true, false, false, false);
        emit ProposalExecuted(id);
        g.execute(id); // anyone can trigger
        assertEq(g.feePercent(), 8);
    }

    function test_no_address_can_set_fee_directly() public {
        _join(1);
        // there is no setter: only execution of a proposal changes it
        assertEq(g.feePercent(), 5);
    }

    function test_fee_above_cap_cannot_be_proposed() public {
        _join(1);
        vm.prank(members[0]);
        vm.expectRevert(Governance.FeeAboveCap.selector);
        g.propose(Governance.Kind.Fee, 21, address(0));
    }

    function test_fee_of_zero_and_cap_are_allowed() public {
        _join(1);
        uint256 id = _propose(Governance.Kind.Fee, 0);
        _vote(id, 0, 1, true);
        _finish();
        g.execute(id);
        assertEq(g.feePercent(), 0);
        id = _propose(Governance.Kind.Fee, 20);
        _vote(id, 0, 1, true);
        _finish();
        g.execute(id);
        assertEq(g.feePercent(), 20);
    }

    // ---- other governed parameters ----

    function test_rate_minfare_timeout_change_only_by_proposal() public {
        _join(1);
        Governance.Kind[3] memory kinds =
            [Governance.Kind.PerKmRate, Governance.Kind.MinFare, Governance.Kind.ClaimTimeout];
        uint256[3] memory vals = [uint256(5), 6, 7];
        for (uint256 i; i < 3; i++) {
            uint256 id = _propose(kinds[i], vals[i]);
            _vote(id, 0, 1, true);
            _finish();
            g.execute(id);
        }
        assertEq(g.perKmRate(), 5);
        assertEq(g.minFare(), 6);
        assertEq(g.claimTimeout(), 7);
    }

    // ---- who can propose / vote ----

    function test_non_member_cannot_propose_or_vote() public {
        _join(3);
        vm.prank(outsider);
        vm.expectRevert(Governance.NotMember.selector);
        g.propose(Governance.Kind.Fee, 6, address(0));
        uint256 id = _propose(Governance.Kind.Fee, 6);
        vm.prank(outsider);
        vm.expectRevert(Governance.NotEligible.selector);
        g.vote(id, true);
    }

    function test_one_vote_per_member() public {
        _join(3);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        vm.prank(members[0]);
        vm.expectRevert(Governance.AlreadyVoted.selector);
        g.vote(id, true);
    }

    function test_late_joiner_cannot_vote_and_quorum_uses_creation_count() public {
        _join(5); // quorum 1
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _join(5); // 10 members now, quorum would be 2 if recomputed
        vm.prank(members[7]);
        vm.expectRevert(Governance.NotEligible.selector);
        g.vote(id, true);
        _vote(id, 0, 1, true);
        _finish();
        g.execute(id); // 1 vote suffices against the creation-time quorum of 1
        assertEq(g.feePercent(), 6);
    }

    function test_member_who_left_cannot_vote() public {
        _join(3);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        vm.prank(members[1]);
        m.exit();
        vm.prank(members[1]);
        vm.expectRevert(Governance.NotEligible.selector);
        g.vote(id, true);
    }

    function test_cannot_vote_after_period_or_on_unknown_proposal() public {
        _join(3);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _finish();
        vm.prank(members[0]);
        vm.expectRevert(Governance.VotingClosed.selector);
        g.vote(id, true);
        vm.prank(members[0]);
        vm.expectRevert(Governance.UnknownProposal.selector);
        g.vote(99, true);
    }

    // ---- quorum and majority ----

    function test_quorum_rounds_up_with_minimum_one() public {
        _join(3);
        assertEq(g.quorumFor(3), 1); // 20% of 3 = 0.6 -> 1
        assertEq(g.quorumFor(1), 1);
        assertEq(g.quorumFor(5), 1);
        assertEq(g.quorumFor(6), 2); // 1.2 -> 2
        assertEq(g.quorumFor(10), 2);
        assertEq(g.quorumFor(11), 3);
    }

    function test_no_votes_never_passes_even_in_small_coop() public {
        _join(3);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _finish();
        vm.expectRevert(Governance.NotPassed.selector);
        g.execute(id);
    }

    function test_low_turnout_fails() public {
        _join(10); // quorum 2
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        _finish();
        vm.expectRevert(Governance.NotPassed.selector);
        g.execute(id);
    }

    function test_quorum_exactly_met_passes() public {
        _join(10);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 2, true);
        _finish();
        g.execute(id);
        assertEq(g.feePercent(), 6);
    }

    function test_against_exceeding_for_fails() public {
        _join(10);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        _vote(id, 1, 4, false);
        _finish();
        vm.expectRevert(Governance.NotPassed.selector);
        g.execute(id);
    }

    function test_tie_fails() public {
        _join(10);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        _vote(id, 1, 2, false);
        _finish();
        vm.expectRevert(Governance.NotPassed.selector);
        g.execute(id);
    }

    function test_cannot_execute_before_voting_ends() public {
        _join(1);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        vm.expectRevert(Governance.VotingStillOpen.selector);
        g.execute(id);
    }

    function test_cannot_execute_twice() public {
        _join(1);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        _vote(id, 0, 1, true);
        _finish();
        g.execute(id);
        vm.expectRevert(Governance.AlreadyExecuted.selector);
        g.execute(id);
    }

    function test_proposal_and_vote_events() public {
        _join(1);
        vm.expectEmit(true, true, false, true);
        emit ProposalCreated(1, members[0], Governance.Kind.Fee, 6, address(0), block.timestamp + PERIOD, 1);
        uint256 id = _propose(Governance.Kind.Fee, 6);
        assertEq(id, 1);
        vm.expectEmit(true, true, false, true);
        emit VoteCast(id, members[0], true);
        _vote(id, 0, 1, true);
    }

    // ---- treasury ----

    function test_direct_deposit_is_logged() public {
        vm.deal(outsider, 1 ether);
        vm.expectEmit(true, false, false, true);
        emit TreasuryDeposit(outsider, 0.5 ether);
        vm.prank(outsider);
        (bool ok,) = address(g).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(g.treasuryBalance(), 0.5 ether);
    }

    function test_spend_proposal_pays_recipient() public {
        _join(1);
        vm.deal(address(g), 1 ether);
        vm.prank(members[0]);
        uint256 id = g.propose(Governance.Kind.Spend, 0.4 ether, recipient);
        _vote(id, 0, 1, true);
        _finish();
        vm.expectEmit(true, true, false, true);
        emit TreasurySpend(id, recipient, 0.4 ether);
        g.execute(id);
        assertEq(recipient.balance, 0.4 ether);
        assertEq(g.treasuryBalance(), 0.6 ether);
    }

    function test_spend_over_balance_reverts_at_execution() public {
        _join(1);
        vm.deal(address(g), 1 ether);
        vm.prank(members[0]);
        uint256 id = g.propose(Governance.Kind.Spend, 0.8 ether, recipient);
        vm.prank(members[0]);
        uint256 id2 = g.propose(Governance.Kind.Spend, 0.8 ether, makeAddr("other"));
        _vote(id, 0, 1, true);
        _vote(id2, 0, 1, true);
        _finish();
        g.execute(id);
        vm.expectRevert(Governance.InsufficientTreasury.selector);
        g.execute(id2); // only 0.2 left
        assertEq(g.treasuryBalance(), 0.2 ether);
    }

    function test_failed_spend_never_executes() public {
        _join(3);
        vm.deal(address(g), 1 ether);
        vm.prank(members[0]);
        uint256 id = g.propose(Governance.Kind.Spend, 0.4 ether, recipient);
        _vote(id, 0, 1, false);
        _finish();
        vm.expectRevert(Governance.NotPassed.selector);
        g.execute(id);
        assertEq(recipient.balance, 0);
    }

    function test_spend_to_zero_address_rejected() public {
        _join(1);
        vm.prank(members[0]);
        vm.expectRevert(Governance.BadRecipient.selector);
        g.propose(Governance.Kind.Spend, 1, address(0));
    }
}
