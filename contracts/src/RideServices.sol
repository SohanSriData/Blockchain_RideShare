// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Membership} from "./Membership.sol";
import {Governance} from "./Governance.sol";

/// @notice Ride lifecycle and fare escrow. Coordinates are emitted in events only and never stored.
contract RideServices {
    enum Status {
        None,
        Requested,
        Accepted,
        Completed,
        Cancelled
    }

    struct Ride {
        address rider;
        address driver;
        uint128 fare;
        Status status;
        uint40 claimableAt;
    }

    Membership public immutable MEMBERSHIP;
    Governance public immutable GOVERNANCE;

    uint256 public rideCount;
    mapping(uint256 => Ride) private rides;
    bool private locked;

    event RideRequested(
        uint256 indexed id, address indexed rider, uint256 fare, int32 pickupLat, int32 pickupLng, int32 dropLat,
        int32 dropLng
    );
    event RideAccepted(uint256 indexed id, address indexed driver);
    event RideCancelled(uint256 indexed id, address indexed rider, address indexed driver, uint256 refund);
    event RideCompleted(uint256 indexed id, address indexed rider, address indexed driver, bool claimed);
    event FareSplit(uint256 indexed id, address indexed driver, uint256 driverAmount, uint256 fee);

    error FareBelowMinimum();
    error BadCoordinates();
    error NotMember();
    error WrongStatus();
    error SelfDealing();
    error NotRider();
    error NotDriver();
    error ClaimTooEarly();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(Membership membership, Governance governance) {
        MEMBERSHIP = membership;
        GOVERNANCE = governance;
    }

    /// @param pickupLat latitude in micro-degrees (degrees x 1e6); published rounded to 3 decimals (milli-degrees)
    function requestRide(int256 pickupLat, int256 pickupLng, int256 dropLat, int256 dropLng)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0 || msg.value < GOVERNANCE.minFare() || msg.value > type(uint128).max) {
            revert FareBelowMinimum();
        }
        if (_abs(pickupLat) > 90e6 || _abs(dropLat) > 90e6 || _abs(pickupLng) > 180e6 || _abs(dropLng) > 180e6) {
            revert BadCoordinates();
        }
        id = ++rideCount;
        rides[id] = Ride(msg.sender, address(0), uint128(msg.value), Status.Requested, 0);
        emit RideRequested(id, msg.sender, msg.value, _round(pickupLat), _round(pickupLng), _round(dropLat), _round(dropLng));
    }

    function acceptRide(uint256 id) external {
        Ride storage ride = rides[id];
        if (!MEMBERSHIP.isMember(msg.sender)) revert NotMember();
        if (ride.status != Status.Requested) revert WrongStatus();
        if (ride.rider == msg.sender) revert SelfDealing();
        ride.status = Status.Accepted;
        ride.driver = msg.sender;
        ride.claimableAt = uint40(block.timestamp + GOVERNANCE.claimTimeout());
        MEMBERSHIP.rideStarted(msg.sender);
        emit RideAccepted(id, msg.sender);
    }

    function cancelRide(uint256 id) external nonReentrant {
        Ride storage ride = rides[id];
        if (ride.rider != msg.sender) revert NotRider();
        Status s = ride.status;
        if (s != Status.Requested && s != Status.Accepted) revert WrongStatus();
        address driver = ride.driver;
        uint256 fare = ride.fare;
        ride.status = Status.Cancelled;
        if (s == Status.Accepted) MEMBERSHIP.rideEnded(driver);
        emit RideCancelled(id, msg.sender, driver, fare);
        _send(msg.sender, fare);
    }

    function completeRide(uint256 id) external nonReentrant {
        Ride storage ride = rides[id];
        if (ride.rider != msg.sender) revert NotRider();
        if (ride.status != Status.Accepted) revert WrongStatus();
        _settle(id, ride, false);
    }

    /// @notice Driver claims the fare if the rider has not confirmed or cancelled by the snapshotted timeout.
    function claimFare(uint256 id) external nonReentrant {
        Ride storage ride = rides[id];
        if (ride.status != Status.Accepted) revert WrongStatus();
        if (ride.driver != msg.sender) revert NotDriver();
        if (block.timestamp < ride.claimableAt) revert ClaimTooEarly();
        _settle(id, ride, true);
    }

    function getRide(uint256 id)
        external
        view
        returns (address rider, address driver, uint256 fare, Status status, uint256 claimableAt)
    {
        Ride storage ride = rides[id];
        return (ride.rider, ride.driver, ride.fare, ride.status, ride.claimableAt);
    }

    /// @dev Effects first, then fee and driver payout, one transaction. Fee rounds down; the driver gets the rest.
    function _settle(uint256 id, Ride storage ride, bool claimed) private {
        address driver = ride.driver;
        address rider = ride.rider;
        uint256 fare = ride.fare;
        uint256 fee = fare * GOVERNANCE.feePercent() / 100;
        uint256 driverAmount = fare - fee;
        ride.status = Status.Completed;
        MEMBERSHIP.rideEnded(driver);
        emit FareSplit(id, driver, driverAmount, fee);
        emit RideCompleted(id, rider, driver, claimed);
        if (fee > 0) _send(address(GOVERNANCE), fee);
        _send(driver, driverAmount);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _abs(int256 v) private pure returns (uint256) {
        return v < 0 ? uint256(-v) : uint256(v);
    }

    /// @dev micro-degrees to milli-degrees, half away from zero.
    function _round(int256 v) private pure returns (int32) {
        if (v >= 0) return int32((v + 500) / 1000);
        return -int32((-v + 500) / 1000);
    }
}
