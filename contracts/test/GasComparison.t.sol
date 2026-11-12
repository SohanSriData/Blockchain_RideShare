// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console} from "forge-std/console.sol";
import {Fixture} from "./Fixture.sol";

/// @dev Baseline: the naive design that keeps every ride detail (coordinates, timestamps) in contract storage.
/// It has no fee split or membership, so it UNDERSTATES the real design's work; the comparison is conservative.
contract BaselineRides {
    struct Ride {
        address rider;
        address driver;
        uint256 fare;
        uint8 status;
        int256 pickupLat;
        int256 pickupLng;
        int256 dropLat;
        int256 dropLng;
        uint256 requestedAt;
        uint256 acceptedAt;
    }

    mapping(uint256 => Ride) public rides;
    uint256 public count;

    function requestRide(int256 a, int256 b, int256 c, int256 d) external payable returns (uint256 id) {
        id = ++count;
        rides[id] = Ride(msg.sender, address(0), msg.value, 1, a, b, c, d, block.timestamp, 0);
    }

    function acceptRide(uint256 id) external {
        Ride storage r = rides[id];
        r.driver = msg.sender;
        r.status = 2;
        r.acceptedAt = block.timestamp;
    }

    function completeRide(uint256 id) external {
        Ride storage r = rides[id];
        r.status = 3;
        (bool ok,) = r.driver.call{value: r.fare}("");
        require(ok);
    }
}

contract GasComparisonTest is Fixture {
    function test_gas_events_only_design_vs_full_on_chain_storage_baseline() public {
        BaselineRides base = new BaselineRides();

        vm.prank(rider);
        uint256 g0 = gasleft();
        uint256 id = r.requestRide{value: FARE}(12_345_678, 77_123_456, 12_400_000, 77_200_000);
        uint256 ourRequest = g0 - gasleft();

        vm.prank(driver);
        g0 = gasleft();
        r.acceptRide(id);
        uint256 ourAccept = g0 - gasleft();

        vm.prank(rider);
        g0 = gasleft();
        r.completeRide(id);
        uint256 ourComplete = g0 - gasleft();

        vm.prank(rider);
        g0 = gasleft();
        uint256 bid = base.requestRide{value: FARE}(12_345_678, 77_123_456, 12_400_000, 77_200_000);
        uint256 baseRequest = g0 - gasleft();

        vm.prank(driver);
        g0 = gasleft();
        base.acceptRide(bid);
        uint256 baseAccept = g0 - gasleft();

        vm.prank(rider);
        g0 = gasleft();
        base.completeRide(bid);
        uint256 baseComplete = g0 - gasleft();

        console.log("requestRide  ours / baseline:", ourRequest, baseRequest);
        console.log("acceptRide   ours / baseline:", ourAccept, baseAccept);
        console.log("completeRide ours / baseline:", ourComplete, baseComplete);
        console.log("request+accept+complete ours:", ourRequest + ourAccept + ourComplete);
        console.log("request+accept+complete base:", baseRequest + baseAccept + baseComplete);

        // Not storing coordinates is the design's main saving: requesting must be clearly cheaper.
        assertLt(ourRequest, baseRequest);
    }
}
