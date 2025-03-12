import React, { useState, useEffect, useCallback } from 'react';
import { Clock, X, Home } from 'lucide-react';
import TaskAbortModal from './task-abort-modal';
// import { eventsCenter } from './game/EventsCenter';

interface Task {
  _id: string;
  taskId: string;
  taskDescription: string;
  isCompleted: boolean;
  isAborted: boolean;
  task_order: number;
  startTime: string;
  endTime: string;
  abortionOptions: string[];
  abortable: boolean;
}

interface SmartHomeSidebarProps {
  tasks: Task[];
  onTasksUpdate: (tasks: Task[]) => void;
}

const SmartHomeSidebar = ({ tasks, onTasksUpdate }: SmartHomeSidebarProps) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);
  const [abortReasons, setAbortReasons] = useState([]);
  
  // Get current task safely
  const currentTask = tasks[currentTaskIndex] || null;
  
  // Find the current active task based on provided time
  const findCurrentTask = useCallback((time: Date) => {
    const now = time.getTime();
    return tasks.findIndex(task => {
      const start = new Date(task.startTime).getTime();
      const end = new Date(task.endTime).getTime();
      return now >= start && now <= end;
    });
  }, [tasks]);

  // Update current time and check if we need to advance to the next task
  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = new Date();
      setCurrentTime(newTime);
      
      // Get active task based on current time
      const activeTaskIndex = findCurrentTask(newTime);
      
      if (activeTaskIndex !== -1) {
        // If we found an active task based on time, use it
        setCurrentTaskIndex(activeTaskIndex);

        setAbortReasons(tasks[currentTaskIndex].abortionOptions);
      } else if (currentTask) {
        // No active task found - check if current task has expired
        const endTime = new Date(currentTask.endTime).getTime();
        const now = newTime.getTime();
        
        // If current task's end time has passed, move to the next task
        if (now > endTime && currentTaskIndex < tasks.length - 1) {
          setCurrentTaskIndex(prevIndex => prevIndex + 1);
          setAbortReasons(tasks[currentTaskIndex].abortionOptions);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tasks, currentTaskIndex, currentTask, findCurrentTask]);
  
  // Calculate remaining tasks (excluding completed, aborted, and expired tasks)
  const tasksRemaining = tasks.filter(task => {
    const isExpired = new Date(task.endTime).getTime() < currentTime.getTime();
    return !task.isCompleted && !task.isAborted && !isExpired;
  }).length;
  
  // Calculate remaining time for current task
  const getRemainingTime = useCallback(() => {
    if (!currentTask || tasksRemaining === 0) return 0;
    
    const endTime = new Date(currentTask.endTime).getTime();
    const now = currentTime.getTime();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  }, [currentTask, currentTime, tasksRemaining]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  
  // Open abort modal
  const openAbortModal = () => {
    setIsAbortModalOpen(true);
  };
  
  // Close abort modal
  const closeAbortModal = () => {
    setIsAbortModalOpen(false);
  };
  
  // Handle task abortion
  const handleAbortTask = async (reasonIndex: number) => {
    try {
      const sessionId = localStorage.getItem('smartHomeSessionId');
      if (!sessionId || !currentTask) {
        console.error('Missing session ID or current task');
        return;
      }

      const response = await fetch('/api/abort-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          taskId: currentTask.taskId,
          abortedReason: abortReasons[reasonIndex]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to abort task');
      }

      const responseData = await response.json();
      onTasksUpdate(responseData.tasks);

      const newTime = new Date(new Date().getTime() + 1000);
      setCurrentTime(newTime);

      let updatedProperties = responseData.updated_properties;
      console.log(updatedProperties);

      import('./game/EventsCenter').then(({ eventsCenter }) => {
        if(updatedProperties.length != 0){
          for(let i = 0; i < updatedProperties.length; i++){
            console.log(updatedProperties[i]);
            eventsCenter.emit('update-smarty-interaction', updatedProperties[i]);
            eventsCenter.emit('update-interaction', updatedProperties[i]);
          }
        }
      });
      
      // Get active task based on current time
      const activeTaskIndex = findCurrentTask(newTime);

      if (activeTaskIndex !== -1) {
        // If we found an active task based on time, use it
        setCurrentTaskIndex(activeTaskIndex);
      }
      
    } catch (error) {
      console.error('Error aborting task:', error);
    }
    setIsAbortModalOpen(false);
  };
  
  // Progress bar rendering
  const renderProgressBar = () => {
    return (
      <div className="mt-4">
        <h3 className="font-bold text-gray-700 mb-2">Progress</h3>
        <div className="flex">
          {tasks.map((task, index) => {
            let bgColor;
            
            // Determine color based on task status
            if (task.isCompleted) {
              bgColor = 'bg-green-500'; // Green for completed
            } else if (task.isAborted) {
              bgColor = 'bg-gray-400'; // Grey for aborted
            } else {
              const now = currentTime.getTime();
              const start = new Date(task.startTime).getTime();
              const end = new Date(task.endTime).getTime();
              
              // All tasks not completed or aborted are white (including in-progress tasks)
              bgColor = 'bg-gray-100'; // White (light gray) for not yet begun or in progress
            }
            
            return (
              <div 
                key={task._id} 
                className={`h-4 ${bgColor} flex-1 mx-0.5 first:ml-0 last:mr-0 rounded-sm`}
              />
            );
          })}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full w-64 bg-white rounded-lg shadow-md p-4 space-y-7">
      {/* Header */}
      <div className="flex items-center justify-center pb-4 border-b border-gray-200">
        <Home className="mr-2 text-blue-600" />
        <h1 className="text-2xl font-bold text-center text-gray-800">Smart Home<br />Simulation</h1>
      </div>
      
      {/* Current Task */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-gray-700">Your Task:</h2>
          {tasksRemaining > 0 && currentTask && currentTask['abortable'] && (
            <button 
              onClick={openAbortModal}
              className="bg-gray-200 rounded-full p-1 hover:bg-gray-300 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {tasksRemaining > 0 ? (
          <p className="mt-2 text-gray-800">{currentTask?.taskDescription || "No active task"}</p>
        ) : (
          <p className="mt-2 text-green-600 font-semibold">All tasks completed!</p>
        )}
      </div>
      
      {/* Timer */}
      <div className="flex items-center justify-center">
        <Clock className="text-gray-600 mr-2" />
        <span className="text-xl font-mono">{formatTime(getRemainingTime())}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-auto border-t border-gray-200 pt-4">
        {renderProgressBar()}
      </div>
      
      {/* Task Abort Modal */}
      <TaskAbortModal
        isOpen={isAbortModalOpen}
        onClose={closeAbortModal}
        onAbort={handleAbortTask}
        abortReasons={abortReasons}
        taskDescription={currentTask?.taskDescription}
      />
    </div>
  );
};

export default SmartHomeSidebar;