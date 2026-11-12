// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./Fixture.sol";
import {Reputation} from "../src/Reputation.sol";

contract ReputationTest is Fixture {
    event RatingSubmitted(
        uint256 indexed rideId, address indexed rater, address indexed ratee, Reputation.Role role, uint8 score
    );

    function _rateDriver(uint256 id, uint8 s) internal {
        vm.prank(rider);
        rep.rate(id, s);
    }

    function test_rider_rates_driver_after_completion() public {
        uint256 id = _completedRide();
        vm.expectEmit(true, true, true, true);
        emit RatingSubmitted(id, rider, driver, Reputation.Role.Driver, 5);
        _rateDriver(id, 5);
        (uint256 sum, uint256 count) = rep.driverProfile(driver);
        assertEq(sum, 5);
        assertEq(count, 1);
    }

    function test_driver_rates_rider_after_completion() public {
        uint256 id = _completedRide();
        vm.expectEmit(true, true, true, true);
        emit RatingSubmitted(id, driver, rider, Reputation.Role.Rider, 2);
        vm.prank(driver);
        rep.rate(id, 2);
        (uint256 sum, uint256 count) = rep.riderProfile(rider);
        assertEq(sum, 2);
        assertEq(count, 1);
    }

    function test_driver_and_rider_profiles_do_not_mix() public {
        // driver also rides as a rider
        uint256 id = _completedRide();
        _rateDriver(id, 5);
        (uint256 s, uint256 c) = rep.riderProfile(driver);
        assertEq(s, 0);
        assertEq(c, 0);
        (s, c) = rep.driverProfile(rider);
        assertEq(c, 0);
    }

    function test_cannot_rate_before_completion_or_when_cancelled() public {
        uint256 id = _request(FARE);
        vm.prank(rider);
        vm.expectRevert(Reputation.RideNotCompleted.selector);
        rep.rate(id, 5);
        _accept(id, driver);
        vm.prank(driver);
        vm.expectRevert(Reputation.RideNotCompleted.selector);
        rep.rate(id, 5);
        vm.prank(rider);
        r.cancelRide(id);
        vm.prank(rider);
        vm.expectRevert(Reputation.RideNotCompleted.selector);
        rep.rate(id, 5);
    }

    function test_strangers_cannot_rate() public {
        uint256 id = _completedRide();
        vm.prank(driver2);
        vm.expectRevert(Reputation.NotParticipant.selector);
        rep.rate(id, 5);
        vm.prank(outsider);
        vm.expectRevert(Reputation.NotParticipant.selector);
        rep.rate(id, 5);
    }

    function test_rating_is_once_per_rater_per_ride_and_immutable() public {
        uint256 id = _completedRide();
        _rateDriver(id, 4);
        vm.prank(rider);
        vm.expectRevert(Reputation.AlreadyRated.selector);
        rep.rate(id, 5);
        (uint256 sum,) = rep.driverProfile(driver);
        assertEq(sum, 4);
        // the counterparty can still rate once
        vm.prank(driver);
        rep.rate(id, 3);
    }

    function test_scores_outside_1_to_5_revert() public {
        uint256 id = _completedRide();
        vm.startPrank(rider);
        vm.expectRevert(Reputation.BadScore.selector);
        rep.rate(id, 0);
        vm.expectRevert(Reputation.BadScore.selector);
        rep.rate(id, 6);
        vm.stopPrank();
    }

    function test_average_is_scaled_by_100_rounded_half_up() public {
        // 5 then 4 -> 4.50
        uint256 a = _completedRide();
        _rateDriver(a, 5);
        uint256 b = _completedRide();
        _rateDriver(b, 4);
        (bool has, uint256 avg) = rep.driverAverage(driver);
        assertTrue(has);
        assertEq(avg, 450);
        // 5,4,4 -> 4.33
        uint256 c = _completedRide();
        _rateDriver(c, 4);
        (, avg) = rep.driverAverage(driver);
        assertEq(avg, 433);
    }

    function test_average_rounds_half_up() public {
        // 3,3,3,3,3,3,4,5: sum 27 over 8 = 3.375 exactly, so half-up gives 338 (down would give 337)
        uint8[8] memory scores = [3, 3, 3, 3, 3, 3, 4, 5];
        for (uint256 i; i < 8; i++) {
            uint256 id = _completedRide();
            _rateDriver(id, scores[i]);
        }
        (, uint256 avg) = rep.driverAverage(driver);
        assertEq(avg, 338);
    }

    function test_non_terminating_average_rounds_to_nearest() public {
        // 1,1,2,2,2,2,2: 12/7 = 1.714285... -> 171
        uint8[7] memory scores = [1, 1, 2, 2, 2, 2, 2];
        for (uint256 i; i < 7; i++) {
            uint256 id = _completedRide();
            _rateDriver(id, scores[i]);
        }
        (, uint256 avg) = rep.driverAverage(driver);
        assertEq(avg, 171);
    }

    function test_empty_profile_reports_no_rating() public view {
        (bool has, uint256 avg) = rep.driverAverage(driver2);
        assertFalse(has);
        assertEq(avg, 0);
        (has, avg) = rep.riderAverage(rider);
        assertFalse(has);
    }
}
