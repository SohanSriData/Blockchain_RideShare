// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./Fixture.sol";
import {RideServices} from "../src/RideServices.sol";
import {Governance} from "../src/Governance.sol";

contract RideServicesTest is Fixture {
    event RideRequested(
        uint256 indexed id, address indexed rider, uint256 fare, int32 pickupLat, int32 pickupLng, int32 dropLat,
        int32 dropLng
    );
    event RideAccepted(uint256 indexed id, address indexed driver);
    event RideCancelled(uint256 indexed id, address indexed rider, address indexed driver, uint256 refund);
    event RideCompleted(uint256 indexed id, address indexed rider, address indexed driver, bool claimed);
    event FareSplit(uint256 indexed id, address indexed driver, uint256 driverAmount, uint256 fee);

    // ---- request / escrow ----

    function test_request_escrows_fare_and_emits_rounded_coordinates() public {
        vm.expectEmit(true, true, false, true);
        // 12.345678 -> 12.346, 77.123456 -> 77.123, 12.4 -> 12.4, 77.2 -> 77.2 (milli-degrees)
        emit RideRequested(1, rider, FARE, 12_346, 77_123, 12_400, 77_200);
        uint256 id = _request(FARE);
        assertEq(id, 1);
        assertEq(address(r).balance, FARE);
        (address rr,, uint256 fare, RideServices.Status s,) = r.getRide(id);
        assertEq(rr, rider);
        assertEq(fare, FARE);
        assertTrue(s == RideServices.Status.Requested);
    }

    function test_negative_coordinates_round_half_away_from_zero() public {
        vm.expectEmit(true, true, false, true);
        emit RideRequested(1, rider, FARE, -33_869, -151_209, -33_500, 10);
        vm.prank(rider);
        r.requestRide{value: FARE}(-33_868_800, -151_208_500, -33_500_000, 9_500);
    }

    function test_request_below_minimum_or_zero_fare_reverts() public {
        vm.startPrank(rider);
        vm.expectRevert(RideServices.FareBelowMinimum.selector);
        r.requestRide{value: 0}(0, 0, 0, 0);
        vm.expectRevert(RideServices.FareBelowMinimum.selector);
        r.requestRide{value: MIN_FARE - 1}(0, 0, 0, 0);
        r.requestRide{value: MIN_FARE}(0, 0, 0, 0);
        vm.stopPrank();
    }

    function test_request_with_out_of_range_coordinates_reverts() public {
        vm.prank(rider);
        vm.expectRevert(RideServices.BadCoordinates.selector);
        r.requestRide{value: FARE}(91_000_000, 0, 0, 0);
        vm.prank(rider);
        vm.expectRevert(RideServices.BadCoordinates.selector);
        r.requestRide{value: FARE}(0, 181_000_000, 0, 0);
    }

    function test_any_account_can_request_and_any_member_sees_it() public {
        uint256 id = _request(FARE);
        _accept(id, driver2); // any staked member can serve it
        (, address d,,,) = r.getRide(id);
        assertEq(d, driver2);
    }

    // ---- accept ----

    function test_accept_by_member_emits_and_marks_in_progress() public {
        uint256 id = _request(FARE);
        vm.expectEmit(true, true, false, false);
        emit RideAccepted(id, driver);
        _accept(id, driver);
        (, address d,, RideServices.Status s, uint256 claimableAt) = r.getRide(id);
        assertEq(d, driver);
        assertTrue(s == RideServices.Status.Accepted);
        assertEq(claimableAt, block.timestamp + TIMEOUT);
        assertEq(m.activeRides(driver), 1);
    }

    function test_non_member_cannot_accept() public {
        uint256 id = _request(FARE);
        vm.prank(outsider);
        vm.expectRevert(RideServices.NotMember.selector);
        r.acceptRide(id);
    }

    function test_only_one_driver_can_accept() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.prank(driver2);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.acceptRide(id);
    }

    function test_driver_cannot_accept_own_request() public {
        vm.prank(driver);
        uint256 id = r.requestRide{value: FARE}(0, 0, 0, 0);
        vm.prank(driver);
        vm.expectRevert(RideServices.SelfDealing.selector);
        r.acceptRide(id);
    }

    function test_cannot_accept_cancelled_or_unknown_ride() public {
        uint256 id = _request(FARE);
        vm.prank(rider);
        r.cancelRide(id);
        vm.prank(driver);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.acceptRide(id);
        vm.prank(driver);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.acceptRide(42);
    }

    function test_member_cannot_exit_while_ride_in_progress() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.prank(driver);
        vm.expectRevert();
        m.exit();
        _complete(id);
        vm.prank(driver);
        m.exit();
        assertFalse(m.isMember(driver));
    }

    // ---- cancel ----

    function test_cancel_unaccepted_ride_refunds_in_full() public {
        uint256 id = _request(FARE);
        uint256 before_ = rider.balance;
        vm.expectEmit(true, true, true, true);
        emit RideCancelled(id, rider, address(0), FARE);
        vm.prank(rider);
        r.cancelRide(id);
        assertEq(rider.balance, before_ + FARE);
        assertEq(address(r).balance, 0);
        (,,, RideServices.Status s,) = r.getRide(id);
        assertTrue(s == RideServices.Status.Cancelled);
    }

    function test_cancel_after_accept_refunds_in_full_and_notifies_driver() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        uint256 before_ = rider.balance;
        vm.expectEmit(true, true, true, true);
        emit RideCancelled(id, rider, driver, FARE);
        vm.prank(rider);
        r.cancelRide(id);
        assertEq(rider.balance, before_ + FARE);
        assertEq(m.activeRides(driver), 0);
    }

    function test_only_rider_can_cancel_or_complete() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.startPrank(driver);
        vm.expectRevert(RideServices.NotRider.selector);
        r.cancelRide(id);
        vm.expectRevert(RideServices.NotRider.selector);
        r.completeRide(id);
        vm.stopPrank();
        vm.prank(outsider);
        vm.expectRevert(RideServices.NotRider.selector);
        r.cancelRide(id);
    }

    function test_no_double_cancel_or_cancel_after_complete() public {
        uint256 id = _request(FARE);
        vm.startPrank(rider);
        r.cancelRide(id);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.cancelRide(id);
        vm.stopPrank();
        uint256 id2 = _request(FARE);
        _accept(id2, driver);
        _complete(id2);
        vm.prank(rider);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.cancelRide(id2);
    }

    // ---- complete / fee split ----

    function test_completion_splits_fare_atomically_5_percent() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        uint256 dBefore = driver.balance;
        vm.expectEmit(true, true, false, true);
        emit FareSplit(id, driver, 0.095 ether, 0.005 ether);
        vm.expectEmit(true, true, true, true);
        emit RideCompleted(id, rider, driver, false);
        _complete(id);
        assertEq(driver.balance, dBefore + 0.095 ether);
        assertEq(g.treasuryBalance(), 0.005 ether);
        assertEq(address(r).balance, 0);
        assertEq(m.activeRides(driver), 0);
    }

    function test_fee_rounds_down_and_remainder_goes_to_driver_without_loss() public {
        uint256 fare = 0.1 ether + 7; // 5% = 0.005e18 + 0.35 -> fee rounds down
        uint256 id = _request(fare);
        _accept(id, driver);
        uint256 dBefore = driver.balance;
        _complete(id);
        uint256 fee = g.treasuryBalance();
        assertEq(fee, fare * 5 / 100);
        assertEq(driver.balance - dBefore + fee, fare); // nothing lost or created
    }

    function test_completion_uses_currently_governed_fee() public {
        vm.prank(driver);
        uint256 pid = g.propose(Governance.Kind.Fee, 10, address(0));
        vm.prank(driver);
        g.vote(pid, true);
        vm.warp(block.timestamp + PERIOD);
        g.execute(pid);
        uint256 id = _request(FARE);
        _accept(id, driver);
        _complete(id);
        assertEq(g.treasuryBalance(), 0.01 ether);
    }

    function test_zero_fee_pays_driver_everything() public {
        vm.prank(driver);
        uint256 pid = g.propose(Governance.Kind.Fee, 0, address(0));
        vm.prank(driver);
        g.vote(pid, true);
        vm.warp(block.timestamp + PERIOD);
        g.execute(pid);
        uint256 id = _request(FARE);
        _accept(id, driver);
        uint256 dBefore = driver.balance;
        _complete(id);
        assertEq(driver.balance, dBefore + FARE);
        assertEq(g.treasuryBalance(), 0);
    }

    function test_cannot_complete_unaccepted_or_twice() public {
        uint256 id = _request(FARE);
        vm.prank(rider);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.completeRide(id);
        _accept(id, driver);
        _complete(id);
        vm.prank(rider);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.completeRide(id);
    }

    // ---- claim after timeout ----

    function test_driver_claim_blocked_before_timeout() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.warp(block.timestamp + TIMEOUT - 1);
        vm.prank(driver);
        vm.expectRevert(RideServices.ClaimTooEarly.selector);
        r.claimFare(id);
    }

    function test_driver_claim_after_timeout_splits_fare() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.warp(block.timestamp + TIMEOUT);
        uint256 dBefore = driver.balance;
        vm.expectEmit(true, true, true, true);
        emit RideCompleted(id, rider, driver, true);
        vm.prank(driver);
        r.claimFare(id);
        assertEq(driver.balance, dBefore + 0.095 ether);
        assertEq(g.treasuryBalance(), 0.005 ether);
        assertEq(m.activeRides(driver), 0);
    }

    function test_only_the_driver_can_claim() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.warp(block.timestamp + TIMEOUT);
        vm.prank(driver2);
        vm.expectRevert(RideServices.NotDriver.selector);
        r.claimFare(id);
    }

    function test_rider_cancel_before_claim_beats_the_claim() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.warp(block.timestamp + TIMEOUT - 1);
        vm.prank(rider);
        r.cancelRide(id);
        vm.warp(block.timestamp + 10);
        vm.prank(driver);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.claimFare(id);
    }

    function test_no_claim_after_rider_completed() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        _complete(id);
        vm.warp(block.timestamp + TIMEOUT);
        vm.prank(driver);
        vm.expectRevert(RideServices.WrongStatus.selector);
        r.claimFare(id);
    }

    function test_claim_timeout_is_snapshotted_at_acceptance() public {
        uint256 id = _request(FARE);
        _accept(id, driver);
        vm.prank(driver);
        uint256 pid = g.propose(Governance.Kind.ClaimTimeout, 1 days, address(0));
        vm.prank(driver);
        g.vote(pid, true);
        vm.warp(block.timestamp + PERIOD);
        g.execute(pid);
        vm.warp(block.timestamp + TIMEOUT); // original 30 min has elapsed
        vm.prank(driver);
        r.claimFare(id);
    }

    // ---- reentrancy & conservation ----

    function test_reentrant_driver_cannot_drain_escrow() public {
        Reenterer evil = new Reenterer(r);
        vm.deal(address(evil), 1 ether);
        evil.join(m);
        uint256 id = _request(FARE);
        uint256 other = _request(FARE);
        evil.accept(id);
        vm.warp(block.timestamp + TIMEOUT);
        evil.target(other);
        evil.claim(id);
        // whatever the attacker attempted, the second ride's escrow is untouched
        assertEq(address(r).balance, FARE);
    }

    function testFuzz_conservation_of_funds(uint96 fare, uint8 feePct) public {
        fare = uint96(bound(fare, MIN_FARE, 5 ether));
        feePct = uint8(bound(feePct, 0, 20));
        if (feePct != 5) {
            vm.prank(driver);
            uint256 pid = g.propose(Governance.Kind.Fee, feePct, address(0));
            vm.prank(driver);
            g.vote(pid, true);
            vm.warp(block.timestamp + PERIOD);
            g.execute(pid);
        }
        uint256 totalBefore = rider.balance + driver.balance + address(g).balance + address(r).balance;
        uint256 id = _request(fare);
        _accept(id, driver);
        _complete(id);
        assertEq(rider.balance + driver.balance + address(g).balance + address(r).balance, totalBefore);
        assertEq(address(r).balance, 0);
        assertEq(g.treasuryBalance(), uint256(fare) * feePct / 100);
    }
}

contract Reenterer {
    RideServices r;
    uint256 victim;
    bool entered;

    constructor(RideServices r_) {
        r = r_;
    }

    function join(Membership m_) external {
        m_.join{value: m_.STAKE()}();
    }

    function accept(uint256 id) external {
        r.acceptRide(id);
    }

    function claim(uint256 id) external {
        r.claimFare(id);
    }

    function target(uint256 id) external {
        victim = id;
    }

    receive() external payable {
        if (entered) return;
        entered = true;
        // try to re-enter every payout path
        try r.claimFare(victim) {} catch {}
        try r.cancelRide(victim) {} catch {}
        try r.completeRide(victim) {} catch {}
    }
}

import {Membership} from "../src/Membership.sol";
