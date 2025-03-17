import React, { useState, useEffect, useCallback } from 'react';
// import { DynamicIcon } from 'lucide-react/dynamic';

interface EnvironmentBarProps {
  explanationTrigger?: (message: string) => void;
}

const EnvironmentBar = ({ explanationTrigger }: EnvironmentBarProps) => {
  const [weather, setWeather] = useState('Sunny');
  const [temperature, setTemperature] = useState('72°F');
  
  return (
    <div className="flex flex-col bg-white rounded-lg shadow-md p-4">
      <div className="flex flex-row items-center justify-start space-x-6">
        {/* Weather Information */}
        <div className="flex items-center space-x-2">
          {/* <DynamicIcon name="sun" size={20} className="text-yellow-500" /> */}
          <span className="font-medium">Weather: {weather}</span>
        </div>

        
        {/* Temperature Information */}
        <div className="flex items-center space-x-2">
          {/* <DynamicIcon name="thermometer" size={20} className="text-red-500" /> */}
          <span className="font-medium">Temperature: {temperature}</span>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentBar;