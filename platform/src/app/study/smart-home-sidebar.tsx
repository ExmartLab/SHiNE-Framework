import React, { useState, useEffect, useCallback } from 'react';
import { Clock, X, Home, HelpCircle, Send } from 'lucide-react';
import TaskAbortModal from './task-abort-modal';
import { getSocket } from './services/socketService';
import { useRouter } from "next/navigation";
import { SmartHomeSidebarProps } from './types';

/**
 * Smart Home Sidebar component that displays task information, timer, and controls
 * Manages task progression, timeouts, completion, and user interactions during the study
 * Provides explanation requests, task abortion, and real-time progress tracking
 */
const SmartHomeSidebar = ({ 
  tasks, 
  explanationTrigger, 
  currentTaskIndex, 
  setCurrentTaskIndex,
  allowUserMessage = false
}: SmartHomeSidebarProps) => {
  const router = useRouter();
  /** Current real-world time for timer calculations */
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  /** Whether the task abort modal is currently visible */
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);
  /** Array of abort reason options for the current task */
  const [abortReasons, setAbortReasons] = useState([]);
  /** User's custom message for explanation requests */
  const [userMessage, setUserMessage] = useState('');
  /** Whether the message input field is expanded */
  const [isExpanded, setIsExpanded] = useState(false);
  
  /** Currently active task (safely retrieved) */
  const currentTask = tasks[currentTaskIndex] || null;
  
  /**
   * Finds the task that should be active based on the current time
   * Compares current time against task start and end times
   * @param time Current time to check against task schedules
   * @returns Index of the active task, or -1 if none are active
   */
  const findCurrentTask = useCallback((time: Date) => {
    const now = time.getTime();
    return tasks.findIndex(task => {
      const start = new Date(task.startTime).getTime();
      const end = new Date(task.endTime).getTime();
      return now >= start && now <= end;
    });
  }, [tasks]);

  /**
   * Main timer effect that handles task progression and study completion
   * Runs every second to:
   * 1. Update current time for timer display
   * 2. Check for task timeouts and notify backend
   * 3. Advance to next task when time-based transitions occur
   * 4. Complete study when all tasks are finished
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      const newTime = new Date();
      setCurrentTime(newTime);

      const sessionId = localStorage.getItem('smartHomeSessionId');
      
      // Check if current task has exceeded its time limit
      if (currentTask) {
        const endTime = new Date(currentTask.endTime).getTime();
        const now = newTime.getTime();
        
        if (now > endTime && !currentTask.isCompleted && !currentTask.isAborted) {
          // Notify backend about task timeout via WebSocket
          if (sessionId) {
            const socket = getSocket();
            if (socket && socket.connected) {
              socket.emit('task-timeout', {
                sessionId,
                taskId: currentTask.taskId
              });
            }
          }
        }
      }
      
      // Check if we should transition to a different task based on time
      const activeTaskIndex = findCurrentTask(newTime);
      
      if (activeTaskIndex !== -1 && activeTaskIndex !== currentTaskIndex) {
        setCurrentTaskIndex(activeTaskIndex);
        setAbortReasons(tasks[activeTaskIndex].abortionOptions);
      }

      // Check if all tasks are completed to end the study
      const remainingTasks = tasks.filter(task => {
        return !task.isCompleted && !task.isAborted && !task.isTimedOut;
      });
      
      if(remainingTasks.length == 0){
        clearInterval(interval);

        // Call backend API to mark study as completed
        const response = await fetch('/api/complete-study', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionId,
          }),
        })

        if (response.ok) {
          localStorage.removeItem('smartHomeSessionId');
          router.push('/finish');
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tasks, currentTaskIndex, currentTask, findCurrentTask]);
  
  /** Number of tasks that are still pending (not completed, aborted, or timed out) */
  const tasksRemaining = tasks.filter(task => {
    return !task.isCompleted && !task.isAborted && !task.isTimedOut;
  }).length;
  
  /**
   * Calculates remaining time in seconds for the current task
   * @returns Remaining seconds, or 0 if no task is active or all tasks completed
   */
  const getRemainingTime = useCallback(() => {
    if (!currentTask || tasksRemaining === 0) return 0;
    
    const endTime = new Date(currentTask.endTime).getTime();
    const now = currentTime.getTime();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  }, [currentTask, currentTime, tasksRemaining]);
  
  /**
   * Formats time from seconds to MM:SS display format
   * @param seconds Time in seconds to format
   * @returns Formatted time string (e.g., "05:30")
   */
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  
  /**
   * Opens the task abort modal for reason selection
   */
  const openAbortModal = () => {
    setIsAbortModalOpen(true);
  };
  
  /**
   * Closes the task abort modal
   */
  const closeAbortModal = () => {
    setIsAbortModalOpen(false);
  };
  
  /**
   * Handles explanation requests to the AI system
   * Sends either a generic request or includes user's custom message
   */
  const handleExplainMe = () => {
    const sessionId = localStorage.getItem('smartHomeSessionId');
    if (!sessionId) {
      console.error('Missing session ID');
      return;
    }
    
    const socket = getSocket();
    if (socket && socket.connected) {
      
      // Include custom user message if provided and allowed
      if (allowUserMessage && userMessage.trim()) {
        socket.emit('explanation_request', { 
          sessionId,
          userMessage: userMessage.trim()
        });
        setUserMessage('');
        setIsExpanded(false);
      } else {
        socket.emit('explanation_request', { sessionId });
      }
    } else {
      console.error('Socket not connected');
    }
  };
  
  /**
   * Handles task abortion with selected reason
   * Sends abort request to backend via WebSocket and closes modal
   * @param reasonIndex Index of the selected abort reason
   */
  const handleAbortTask = async (reasonIndex: number) => {
    try {
      const sessionId = localStorage.getItem('smartHomeSessionId');
      if (!sessionId || !currentTask) {
        console.error('Missing session ID or current task');
        return;
      }

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('task-abort', {
          sessionId,
          taskId: currentTask.taskId,
          abortOption: abortReasons[reasonIndex]
        });
      }

    } catch (error) {
      console.error('Error aborting task:', error);
    }
    setIsAbortModalOpen(false);
  };
  
  /**
   * Toggles the visibility of the message input field
   */
  const toggleMessageInput = () => {
    setIsExpanded(!isExpanded);
  };

  /**
   * Handles changes to the user message input field
   * @param e Input change event
   */
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserMessage(e.target.value);
  };

  /**
   * Sends the user message when send button is clicked
   */
  const handleSendMessage = () => {
    if (userMessage.trim()) {
      handleExplainMe();
    }
  };

  /**
   * Handles Enter key press in message input field
   * @param e Keyboard event
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && userMessage.trim()) {
      handleExplainMe();
    }
  };
  
  /**
   * Renders the progress bar showing task completion status
   * Uses color coding: green (completed), gray (aborted/timed out), light gray (pending/active)
   * @returns JSX element containing the progress visualization
   */
  const renderProgressBar = () => {
    return (
      <div className="mt-4">
        <h3 className="font-bold text-gray-700 mb-2">Progress</h3>
        <div className="flex">
          {tasks.map((task) => {
            let bgColor;
            
            // Determine visual state based on task status
            if (task.isCompleted) {
              bgColor = 'bg-green-500';
            } else if (task.isAborted || task.isTimedOut) {
              bgColor = 'bg-gray-500';
            } else {              
              bgColor = 'bg-gray-100';
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
  
  /**
   * Renders the explanation request section with optional custom message input
   * Only displays when explanation trigger is set to 'on_demand'
   * @returns JSX element or null if explanations are not on-demand
   */
  const renderExplainMeSection = () => {
    if (explanationTrigger !== 'on_demand') {
      return null;
    }
  
    return (
      <div className="flex flex-col w-full">
        {/* Main explanation request button */}
        <button
          onClick={allowUserMessage ? toggleMessageInput : handleExplainMe}
          className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          <HelpCircle className="mr-2" size={18} />
          Explain Me
        </button>
  
        {/* Expandable message input for custom questions */}
        {allowUserMessage && isExpanded && (
          <div className="mt-2 flex items-center px-0">
            <input
              type="text"
              value={userMessage}
              onChange={handleMessageChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              className="flex-1 border border-gray-300 rounded-l-md py-2 px-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!userMessage.trim()}
              className={`bg-blue-500 hover:bg-blue-600 text-white rounded-r-md py-3 px-3 transition-colors ${!userMessage.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full w-64 bg-white rounded-lg shadow-md p-4 space-y-7">
      {/* Sidebar header with platform branding */}
      <div className="flex items-center justify-center pb-4 border-b border-gray-200">
        <Home className="mr-2 text-blue-600" />
        <h1 className="text-2xl font-bold text-center text-gray-800">Smart Home<br />Simulation</h1>
      </div>
      
      {/* Current task display with optional abort button */}
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
      
      {/* Countdown timer for current task */}
      <div className="flex items-center justify-center">
        <Clock className="text-gray-600 mr-2" />
        <span className="text-xl font-mono">{formatTime(getRemainingTime())}</span>
      </div>
      
      {/* Explanation request section (conditional) */}
      {renderExplainMeSection()}
           
      {/* Progress bar showing overall study completion */}
      <div className="mt-auto border-t border-gray-200 pt-4">
        {renderProgressBar()}
      </div>
      
      {/* Modal for task abortion reason selection */}
      <TaskAbortModal
        isOpen={isAbortModalOpen}
        onClose={closeAbortModal}
        onAbort={handleAbortTask}
        abortReasons={abortReasons}
      />
    </div>
  );
};

export default SmartHomeSidebar;