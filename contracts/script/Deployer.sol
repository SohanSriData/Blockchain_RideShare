// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CommonBase} from "forge-std/Base.sol";
import {Membership} from "../src/Membership.sol";
import {Governance} from "../src/Governance.sol";
import {RideServices} from "../src/RideServices.sol";
import {Reputation} from "../src/Reputation.sol";

/// @dev Deploys the four contracts. Membership needs the (not yet deployed) RideServices address, so it is
/// predicted from the deployer nonce. This keeps every wiring field immutable: there is no owner and no setter.
abstract contract Deployer is CommonBase {
    struct Params {
        uint256 stake;
        uint256 feePercent;
        uint256 feeCapPercent;
        uint256 quorumPercent;
        uint256 votingPeriod;
        uint256 perKmRate;
        uint256 minFare;
        uint256 claimTimeout;
    }

    function _deployAll(address deployer, Params memory p)
        internal
        returns (Membership m, Governance g, RideServices r, Reputation rep)
    {
        uint64 nonce = vm.getNonce(deployer);
        address predictedRide = vm.computeCreateAddress(deployer, nonce + 2);
        m = new Membership(p.stake, predictedRide);
        g = new Governance(
            m, p.feePercent, p.feeCapPercent, p.quorumPercent, p.votingPeriod, p.perKmRate, p.minFare, p.claimTimeout
        );
        r = new RideServices(m, g);
        require(address(r) == predictedRide, "address prediction failed");
        rep = new Reputation(r);
    }
}
