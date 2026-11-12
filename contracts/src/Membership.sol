// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Staked membership. Joining costs exactly STAKE; exit refunds it unless a ride is in progress.
contract Membership {
    uint256 public immutable STAKE;
    /// @dev The only address allowed to flag a driver as being on a ride.
    address public immutable RIDE_SERVICES;

    mapping(address => bool) public isMember;
    /// @notice Monotonic join order (0 = never joined). Governance uses it to exclude late joiners.
    mapping(address => uint256) public joinSeq;
    mapping(address => uint256) public activeRides;
    uint256 public memberCount;
    uint256 public joinCounter;

    event MemberJoined(address indexed member, uint256 stake);
    event MemberExited(address indexed member, uint256 stake);

    error WrongStake();
    error AlreadyMember();
    error NotMember();
    error RideInProgress();
    error OnlyRideServices();
    error TransferFailed();

    constructor(uint256 stake, address rideServices) {
        STAKE = stake;
        RIDE_SERVICES = rideServices;
    }

    function join() external payable {
        if (msg.value != STAKE) revert WrongStake();
        if (isMember[msg.sender]) revert AlreadyMember();
        isMember[msg.sender] = true;
        joinSeq[msg.sender] = ++joinCounter;
        memberCount++;
        emit MemberJoined(msg.sender, msg.value);
    }

    function exit() external {
        if (!isMember[msg.sender]) revert NotMember();
        if (activeRides[msg.sender] != 0) revert RideInProgress();
        isMember[msg.sender] = false;
        memberCount--;
        emit MemberExited(msg.sender, STAKE);
        (bool ok,) = msg.sender.call{value: STAKE}("");
        if (!ok) revert TransferFailed();
    }

    function rideStarted(address driver) external {
        if (msg.sender != RIDE_SERVICES) revert OnlyRideServices();
        activeRides[driver]++;
    }

    function rideEnded(address driver) external {
        if (msg.sender != RIDE_SERVICES) revert OnlyRideServices();
        activeRides[driver]--;
    }
}
