// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Deployer} from "./Deployer.sol";
import {Membership} from "../src/Membership.sol";
import {Governance} from "../src/Governance.sol";
import {RideServices} from "../src/RideServices.sol";
import {Reputation} from "../src/Reputation.sol";

/// @notice Deployment. Env overrides: STAKE, VOTING_PERIOD, CLAIM_TIMEOUT, PER_KM_RATE, MIN_FARE.
/// Defaults: chain 31337 uses 1 min voting / 2 min claim timeout; other chains use 1 day / 30 min.
/// Writes deployments/<chainid>.json for the indexer and the web app. Defaults suit a local Anvil chain.
contract Deploy is Script, Deployer {
    function run() external {
        // Local chains get short timings for demos; any other network (e.g. Sepolia) gets the spec's testnet values.
        bool local = block.chainid == 31337;
        Params memory p = Params({
            stake: vm.envOr("STAKE", uint256(0.01 ether)),
            feePercent: 5,
            feeCapPercent: 20,
            quorumPercent: 20,
            votingPeriod: vm.envOr("VOTING_PERIOD", local ? uint256(1 minutes) : uint256(1 days)),
            perKmRate: vm.envOr("PER_KM_RATE", uint256(0.0005 ether)),
            minFare: vm.envOr("MIN_FARE", uint256(0.001 ether)),
            claimTimeout: vm.envOr("CLAIM_TIMEOUT", local ? uint256(2 minutes) : uint256(30 minutes))
        });

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        (Membership m, Governance g, RideServices r, Reputation rep) = _deployAll(deployer, p);
        vm.stopBroadcast();

        string memory json = "deployment";
        vm.serializeAddress(json, "membership", address(m));
        vm.serializeAddress(json, "governance", address(g));
        vm.serializeAddress(json, "rideServices", address(r));
        vm.serializeAddress(json, "reputation", address(rep));
        string memory out = vm.serializeUint(json, "chainId", block.chainid);
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        console.log("membership", address(m));
        console.log("governance", address(g));
        console.log("rideServices", address(r));
        console.log("reputation", address(rep));
    }
}
