import React, { useState, useEffect, useCallback } from 'react';
import { Task } from '@/types/task';
import { Clock } from 'lucide-react';

interface EnvironmentBarProps {
  tasks: Task[];
  currentTaskId: number;
  gameConfig: any;
}

const EnvironmentBar = ({ gameConfig, tasks, currentTaskId }: EnvironmentBarProps) => {
  // Find the current task based on the currentTaskId
  const currentTask = tasks.find(task => task.task_order === currentTaskId);
  
  // If no environment variables or current task not found, provide defaults
  const environmentVariables = currentTask?.environment || [];

  // State to store the current in-game time
  const [inGameTime, setInGameTime] = useState<string>("");

  // Function to calculate the in-game time
  function calculateInGameTime() {
    let currentTime = new Date();
    let gameStartTime = new Date(gameConfig.environment.time.gameStart);
    let timeDifference = ((currentTime.getTime() - gameStartTime.getTime()) / 1000) * gameConfig.environment.time.speed;

    // Based on start time
    let minute = gameConfig.environment.time.startTime.minute + Math.floor(timeDifference / 60);
    let hour = gameConfig.environment.time.startTime.hour + Math.floor(minute / 60);
    minute = (minute % 60);
    hour = (hour % 24);

    // Make sure minute and hour are two digits
    minute = minute < 10 ? "0" + minute : minute;
    hour = hour < 10? "0" + hour : hour;

    return hour + ":" + minute;
  }

  // Set up an interval to update the in-game time every second
  useEffect(() => {
    // Calculate initial time
    if(!gameConfig){
      return;
    }

    setInGameTime(calculateInGameTime());
    
    // Set up interval to update time every second
    const interval = setInterval(() => {
      setInGameTime(calculateInGameTime());
    }, 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [gameConfig]); // Re-run effect if gameConfig changes
  
  return (
    <div className="flex flex-col bg-white rounded-lg shadow-md p-4">
      <div className="flex flex-row items-center justify-start space-x-6">
        {/* Time */}
        <div className="flex items-center space-x-2">
            {/* You can add dynamic icons based on the environment variable name if needed */}
            <Clock size={20} />
            <span className="font-medium">Time: {inGameTime}</span>
        </div>

        {/* Map through all environment variables for the current task */}
        {environmentVariables.map((env, index) => (
          <div key={index} className="flex items-center space-x-2">
            {/* You can add dynamic icons based on the environment variable name if needed */}
            <span className="font-medium">{env.name}: {env.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnvironmentBar;