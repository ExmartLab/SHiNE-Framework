import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { EnvironmentBarProps } from './types';

/**
 * EnvironmentBar displays real-time game information including current time and task-specific environment variables.
 * The time is calculated based on game configuration settings and updates every second.
 */
const EnvironmentBar = ({ gameConfig, tasks, currentTaskId }: EnvironmentBarProps) => {
  const currentTask = tasks.find(task => task.task_order === currentTaskId);
  const environmentVariables = currentTask?.environment || [];
  const [inGameTime, setInGameTime] = useState<string>("");

  /**
   * Calculates the current in-game time based on real world time elapsed since game start,
   * applying the configured time speed multiplier and start time offset.
   * @returns Formatted time string in HH:MM format
   */
  function calculateInGameTime() {
    let currentTime = new Date();
    let gameStartTime = new Date(gameConfig.environment.time.gameStart);
    let timeDifference = ((currentTime.getTime() - gameStartTime.getTime()) / 1000) * gameConfig.environment.time.speed;

    let minute = gameConfig.environment.time.startTime.minute + Math.floor(timeDifference / 60);
    let hour = gameConfig.environment.time.startTime.hour + Math.floor(minute / 60);
    minute = (minute % 60);
    hour = (hour % 24);

    minute = minute < 10 ? "0" + minute : minute;
    hour = hour < 10? "0" + hour : hour;

    return hour + ":" + minute;
  }

  /**
   * Effect hook that sets up a timer to update the in-game time display every second.
   * Calculates initial time and creates an interval for continuous updates.
   */
  useEffect(() => {
    if(!gameConfig){
      return;
    }

    setInGameTime(calculateInGameTime());
    
    const interval = setInterval(() => {
      setInGameTime(calculateInGameTime());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameConfig]);
  
  return (
    <div className="flex flex-col bg-white rounded-lg shadow-md p-4">
      <div className="flex flex-row items-center justify-start space-x-6">
        <div className="flex items-center space-x-2">
            <Clock size={20} />
            <span className="font-medium">Time: {inGameTime}</span>
        </div>

        {environmentVariables.map((env, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className="font-medium">{env.name}: {env.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnvironmentBar;