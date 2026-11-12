// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./Fixture.sol";
import {Membership} from "../src/Membership.sol";
import {Governance} from "../src/Governance.sol";
import {RideServices} from "../src/RideServices.sol";

/// @dev An account whose receive() always reverts, used to prove failed payouts revert atomically.
contract RejectsEther {
    function join(Membership m_) external payable {
        m_.join{value: msg.value}();
    }

    function exit(Membership m_) external {
        m_.exit();
    }

    function request(RideServices r_) external payable returns (uint256) {
        return r_.requestRide{value: msg.value}(0, 0, 0, 0);
    }

    function cancel(RideServices r_, uint256 id) external {
        r_.cancelRide(id);
    }

    function accept(RideServices r_, uint256 id) external {
        r_.acceptRide(id);
    }

    function propose(Governance g_, uint256 amount, address to) external returns (uint256) {
        return g_.propose(Governance.Kind.Spend, amount, to);
    }

    function vote(Governance g_, uint256 id) external {
        g_.vote(id, true);
    }

    receive() external payable {
        revert("no thanks");
    }
}

contract FailurePathsTest is Fixture {
    function test_constructor_rejects_initial_fee_above_cap() public {
        vm.expectRevert(Governance.FeeAboveCap.selector);
        new Governance(m, 21, 20, 20, PERIOD, 1, 1, 1);
    }

    function test_exit_reverts_atomically_if_member_cannot_receive_stake() public {
        RejectsEther bad = new RejectsEther();
        vm.deal(address(bad), 1 ether);
        bad.join{value: STAKE}(m);
        vm.expectRevert(Membership.TransferFailed.selector);
        bad.exit(m);
        assertTrue(m.isMember(address(bad))); // state rolled back, stake not lost
        assertEq(m.memberCount(), 3);
    }

    function test_cancel_reverts_atomically_if_rider_cannot_receive_refund() public {
        RejectsEther bad = new RejectsEther();
        vm.deal(address(bad), 1 ether);
        uint256 id = bad.request{value: FARE}(r);
        vm.expectRevert(RideServices.TransferFailed.selector);
        bad.cancel(r, id);
        (,,, RideServices.Status s,) = r.getRide(id);
        assertTrue(s == RideServices.Status.Requested);
        assertEq(address(r).balance, FARE);
    }

    function test_completion_reverts_atomically_if_driver_cannot_receive_payout() public {
        RejectsEther bad = new RejectsEther();
        vm.deal(address(bad), 1 ether);
        bad.join{value: STAKE}(m);
        uint256 id = _request(FARE);
        bad.accept(r, id);
        vm.prank(rider);
        vm.expectRevert(RideServices.TransferFailed.selector);
        r.completeRide(id);
        // nothing moved: fee not paid out, escrow intact, ride still accepted
        assertEq(g.treasuryBalance(), 0);
        assertEq(address(r).balance, FARE);
        (,,, RideServices.Status s,) = r.getRide(id);
        assertTrue(s == RideServices.Status.Accepted);
        // the rider can still recover the money by cancelling
        vm.prank(rider);
        r.cancelRide(id);
    }

    function test_spend_reverts_atomically_if_recipient_rejects_funds() public {
        RejectsEther bad = new RejectsEther();
        vm.deal(address(g), 1 ether);
        vm.prank(driver);
        uint256 id = g.propose(Governance.Kind.Spend, 0.1 ether, address(bad));
        vm.prank(driver);
        g.vote(id, true);
        vm.warp(block.timestamp + PERIOD);
        vm.expectRevert(Governance.TransferFailed.selector);
        g.execute(id);
        assertEq(g.treasuryBalance(), 1 ether);
        // reverted execution did not burn the proposal: a later retry is still possible in principle
        vm.expectRevert(Governance.TransferFailed.selector);
        g.execute(id);
    }

    function test_vote_on_proposal_zero_is_unknown() public {
        vm.prank(driver);
        vm.expectRevert(Governance.UnknownProposal.selector);
        g.vote(0, true);
        vm.expectRevert(Governance.UnknownProposal.selector);
        g.execute(0);
    }

    function test_ride_that_does_not_exist_cannot_be_rated_completed_or_claimed() public {
        vm.prank(rider);
        vm.expectRevert(RideServices.NotRider.selector);
        r.completeRide(77);
        vm.prank(driver);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.claimFare(77);
    }
}
