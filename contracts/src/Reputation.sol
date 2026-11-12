// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RideServices} from "./RideServices.sol";

/// @notice Immutable 1-5 ratings tied to a completed ride and its true counterparty. Separate driver and rider profiles.
contract Reputation {
    enum Role {
        Driver,
        Rider
    }

    struct Profile {
        uint128 sum;
        uint128 count;
    }

    RideServices public immutable RIDES;

    mapping(address => Profile) private driverProfiles;
    mapping(address => Profile) private riderProfiles;
    /// @dev rideId => rater => rated
    mapping(uint256 => mapping(address => bool)) public hasRated;

    event RatingSubmitted(uint256 indexed rideId, address indexed rater, address indexed ratee, Role role, uint8 score);

    error BadScore();
    error RideNotCompleted();
    error NotParticipant();
    error AlreadyRated();

    constructor(RideServices rides) {
        RIDES = rides;
    }

    function rate(uint256 rideId, uint8 score) external {
        if (score < 1 || score > 5) revert BadScore();
        (address rider, address driver,, RideServices.Status status,) = RIDES.getRide(rideId);
        if (status != RideServices.Status.Completed) revert RideNotCompleted();
        if (msg.sender != rider && msg.sender != driver) revert NotParticipant();
        if (hasRated[rideId][msg.sender]) revert AlreadyRated();
        hasRated[rideId][msg.sender] = true;
        if (msg.sender == rider) {
            _add(driverProfiles[driver], score);
            emit RatingSubmitted(rideId, msg.sender, driver, Role.Driver, score);
        } else {
            _add(riderProfiles[rider], score);
            emit RatingSubmitted(rideId, msg.sender, rider, Role.Rider, score);
        }
    }

    function driverProfile(address who) external view returns (uint256 sum, uint256 count) {
        Profile storage p = driverProfiles[who];
        return (p.sum, p.count);
    }

    function riderProfile(address who) external view returns (uint256 sum, uint256 count) {
        Profile storage p = riderProfiles[who];
        return (p.sum, p.count);
    }

    /// @return hasRating false when the profile has no ratings
    /// @return averageX100 average scaled by 100 (437 = 4.37), rounded half-up
    function driverAverage(address who) external view returns (bool hasRating, uint256 averageX100) {
        return _average(driverProfiles[who]);
    }

    function riderAverage(address who) external view returns (bool hasRating, uint256 averageX100) {
        return _average(riderProfiles[who]);
    }

    function _add(Profile storage p, uint8 score) private {
        p.sum += score;
        p.count += 1;
    }

    function _average(Profile storage p) private view returns (bool, uint256) {
        uint256 count = p.count;
        if (count == 0) return (false, 0);
        return (true, (uint256(p.sum) * 200 + count) / (count * 2));
    }
}
