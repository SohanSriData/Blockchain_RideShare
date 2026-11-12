// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deployer} from "../script/Deployer.sol";
import {Membership} from "../src/Membership.sol";
import {Governance} from "../src/Governance.sol";
import {RideServices} from "../src/RideServices.sol";
import {Reputation} from "../src/Reputation.sol";

/// @dev Deploys the whole four-contract suite; tests drive it through public calls only.
abstract contract Fixture is Test, Deployer {
    Membership m;
    Governance g;
    RideServices r;
    Reputation rep;

    address rider = makeAddr("rider");
    address driver = makeAddr("driver");
    address driver2 = makeAddr("driver2");
    address outsider = makeAddr("outsider");

    uint256 constant STAKE = 0.01 ether;
    uint256 constant MIN_FARE = 0.002 ether;
    uint256 constant FARE = 0.1 ether;
    uint256 constant PERIOD = 1 minutes;
    uint256 constant TIMEOUT = 30 minutes;

    function setUp() public virtual {
        (m, g, r, rep) = _deployAll(
            address(this),
            Params({
                stake: STAKE,
                feePercent: 5,
                feeCapPercent: 20,
                quorumPercent: 20,
                votingPeriod: PERIOD,
                perKmRate: 0.001 ether,
                minFare: MIN_FARE,
                claimTimeout: TIMEOUT
            })
        );
        vm.deal(rider, 10 ether);
        vm.deal(driver, 1 ether);
        vm.deal(driver2, 1 ether);
        vm.deal(outsider, 1 ether);
        vm.prank(driver);
        m.join{value: STAKE}();
        vm.prank(driver2);
        m.join{value: STAKE}();
    }

    function _request(uint256 fare) internal returns (uint256 id) {
        vm.prank(rider);
        id = r.requestRide{value: fare}(12_345_678, 77_123_456, 12_400_000, 77_200_000);
    }

    function _accept(uint256 id, address d) internal {
        vm.prank(d);
        r.acceptRide(id);
    }

    function _complete(uint256 id) internal {
        vm.prank(rider);
        r.completeRide(id);
    }

    /// @dev Full happy path to a completed ride.
    function _completedRide() internal returns (uint256 id) {
        id = _request(FARE);
        _accept(id, driver);
        _complete(id);
    }
}
