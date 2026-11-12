// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Membership} from "../src/Membership.sol";

contract MembershipTest is Test {
    Membership m;
    address ride = makeAddr("ride");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant STAKE = 0.01 ether;

    event MemberJoined(address indexed member, uint256 stake);
    event MemberExited(address indexed member, uint256 stake);

    function setUp() public {
        m = new Membership(STAKE, ride);
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
    }

    function test_stake_is_visible_before_joining() public view {
        assertEq(m.STAKE(), STAKE);
    }

    function test_join_with_exact_stake_makes_member_and_emits() public {
        vm.expectEmit(true, false, false, true);
        emit MemberJoined(alice, STAKE);
        vm.prank(alice);
        m.join{value: STAKE}();
        assertTrue(m.isMember(alice));
        assertEq(m.memberCount(), 1);
        assertEq(address(m).balance, STAKE);
    }

    function test_join_with_wrong_stake_reverts() public {
        vm.startPrank(alice);
        vm.expectRevert(Membership.WrongStake.selector);
        m.join{value: STAKE - 1}();
        vm.expectRevert(Membership.WrongStake.selector);
        m.join{value: STAKE + 1}();
        vm.stopPrank();
        assertFalse(m.isMember(alice));
    }

    function test_double_join_reverts() public {
        vm.startPrank(alice);
        m.join{value: STAKE}();
        vm.expectRevert(Membership.AlreadyMember.selector);
        m.join{value: STAKE}();
    }

    function test_exit_refunds_full_stake_and_emits() public {
        vm.prank(alice);
        m.join{value: STAKE}();
        uint256 before_ = alice.balance;
        vm.expectEmit(true, false, false, true);
        emit MemberExited(alice, STAKE);
        vm.prank(alice);
        m.exit();
        assertEq(alice.balance, before_ + STAKE);
        assertFalse(m.isMember(alice));
        assertEq(m.memberCount(), 0);
        assertEq(address(m).balance, 0);
    }

    function test_non_member_cannot_exit() public {
        vm.prank(bob);
        vm.expectRevert(Membership.NotMember.selector);
        m.exit();
    }

    function test_exit_blocked_during_active_ride() public {
        vm.prank(alice);
        m.join{value: STAKE}();
        vm.prank(ride);
        m.rideStarted(alice);
        vm.prank(alice);
        vm.expectRevert(Membership.RideInProgress.selector);
        m.exit();
        vm.prank(ride);
        m.rideEnded(alice);
        vm.prank(alice);
        m.exit();
        assertFalse(m.isMember(alice));
    }

    function test_only_ride_services_can_flag_active_rides() public {
        vm.prank(alice);
        m.join{value: STAKE}();
        vm.prank(bob);
        vm.expectRevert(Membership.OnlyRideServices.selector);
        m.rideStarted(alice);
    }

    function test_rejoin_gets_a_later_join_sequence() public {
        vm.prank(alice);
        m.join{value: STAKE}();
        uint256 first = m.joinSeq(alice);
        vm.prank(bob);
        m.join{value: STAKE}();
        assertGt(m.joinSeq(bob), first);
        assertEq(m.joinCounter(), 2);
    }
}
