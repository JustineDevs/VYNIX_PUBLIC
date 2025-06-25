// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PerpetualTimer {
    address public owner;
    uint256 public timerStart;
    uint256 public timerDuration;
    bool public isTimerActive;
    
    event TimerStarted(address indexed starter, uint256 startTime, uint256 duration);
    event TimerReset(address indexed caller, uint256 newStartTime, uint256 newDuration);
    
    constructor() {
        owner = msg.sender;
        isTimerActive = false;
    }
    
    function startTimer(uint256 durationInSeconds) external {
        require(durationInSeconds > 0, "Duration must be greater than zero");
        
        timerStart = block.timestamp;
        timerDuration = durationInSeconds;
        isTimerActive = true;
        
        if (isTimerActive) {
            emit TimerReset(msg.sender, timerStart, timerDuration);
        } else {
            emit TimerStarted(msg.sender, timerStart, timerDuration);
        }
    }
    
    function checkTimer() external view returns (string memory status, uint256 timeLeft) {
        if (!isTimerActive) {
            return ("Timer is not active", 0);
        }
        if (block.timestamp >= timerStart + timerDuration) {
            return ("Timer has expired", 0);
        }
        uint256 remaining = timerStart + timerDuration - block.timestamp;
        return ("Timer is active", remaining);
    }
    
    function getCurrentTime() external view returns (uint256) {
        return block.timestamp;
    }
} 