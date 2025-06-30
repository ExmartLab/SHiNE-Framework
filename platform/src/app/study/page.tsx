"use client"

import Skeleton from 'react-loading-skeleton';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import SmartHomeSidebar from './smart-home-sidebar';
import EnvironmentBar from './environment-bar';
import 'react-loading-skeleton/dist/skeleton.css'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { initializeSocket, getSocket } from './services/socketService';
import { useRouter } from "next/navigation";
import parse from 'html-react-parser';

/** Dynamically import PhaserGame to avoid SSR issues with Phaser */
const PhaserGame = dynamic(() => import('./game/PhaserGame').then(mod => mod.PhaserGame), {
  ssr: false
})

/**
 * Main study page component that orchestrates the smart home simulation
 * Manages real-time communication, game state, and user interactions
 */
export default function Home() {
  const router = useRouter();
  /** Game configuration loaded from backend */
  const [gameConfig, setGameConfig] = useState(null);
  /** Array of study tasks for the current session */
  const [tasks, setTasks] = useState([]);
  /** Index of the currently active task */
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  /** How explanations are triggered ('automatic' or 'on_demand') */
  const [explanationTrigger, setExplanationTrigger] = useState('automatic');
  /** Whether users can send custom messages for explanations */
  const [allowUserMessage, setAllowUserMessage] = useState(false);
  /** Loading state for initial data fetch */
  const [isLoading, setIsLoading] = useState(true);
  /** Error state for failed operations */
  const [error, setError] = useState(null);
  /** Loading state specifically for Phaser game initialization */
  const [gameLoading, setGameLoading] = useState(true);

  /**
   * Main effect hook that sets up the study environment:
   * 1. Initializes WebSocket connection for real-time communication
   * 2. Validates session and redirects if invalid
   * 3. Sets up event listeners for game updates and explanations
   * 4. Fetches game configuration and tasks
   * 5. Establishes communication between frontend and backend
   */
  useEffect(() => {
    const socket = initializeSocket();
    const sessionId = localStorage.getItem('smartHomeSessionId');
    
    if(!sessionId){
      router.push('/');
      return;
    }

    /**
     * Component for rendering explanation content with optional rating functionality
     * Displays explanations in toast notifications with thumbs up/down rating
     */
    const ExplanationContent = ({ content, explanationId, ratingType }: { 
      content: React.ReactNode, 
      explanationId: string,
      ratingType?: string 
    }) => {
      const [selectedRating, setSelectedRating] = useState<boolean | null>(null);
      
      /**
       * Handles user rating of explanation content
       * @param isLiked Whether the user liked (true) or disliked (false) the explanation
       */
      const handleRating = (isLiked: boolean) => {
        setSelectedRating(isLiked);
        
        socket.emit('explanation_rating', {
          explanation_id: explanationId,
          sessionId: sessionId,
          rating: { is_liked: isLiked }
        });
        
        toast.success(`Rating submitted!`, {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: true
        });
      };
      
      return (
        <div>
          {content}
          {ratingType === 'like' && (
            <>
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => handleRating(true)}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedRating === true 
                      ? 'bg-green-700 text-white font-bold shadow-md' 
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  aria-label="Thumbs up"
                  disabled={selectedRating !== null}
                >
                  👍
                </button>
                <button 
                  onClick={() => handleRating(false)}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedRating === false 
                      ? 'bg-red-700 text-white font-bold shadow-md' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                  aria-label="Thumbs down"
                  disabled={selectedRating !== null}
                >
                  👎
                </button>
              </div>
            </>
          )}
        </div>
      );
    };

    /**
     * Sets up WebSocket event listeners for real-time communication
     * Handles device updates, explanations, and game state changes
     */
    const setupSocketListeners = () => {
      // Listen for device interaction updates from other clients or backend
      socket.on('update-interaction', (data:any) => {
        const updatedData = {
          device: data.deviceId,
          interaction: data.interaction,
          value: data.value
        };
        
        // Delay to ensure game is ready, then update device states
        setTimeout(() => {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            eventsCenter.emit('update-interaction', updatedData);
            eventsCenter.emit('update-smarty-interaction', updatedData);
          });
        }, 300);
      });

      // Listen for explanation responses
      socket.on('explanation', (data: any) => {
        const parsedContent = parse(data.explanation);
        
        // Display explanation in toast notification with rating options
        toast.info(
          <ExplanationContent 
            content={parsedContent} 
            explanationId={data.explanation_id}
            ratingType={data.rating}
          />, 
          {
            position: "top-right",
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          }
        );
      });

      // Listen for game state updates (task completion, rule triggers, etc.)
      socket.on('game-update', (data:any) => {
        const updatedTasks = data.updatedTasks;
        setTasks(updatedTasks);

        // Update device properties if provided
        const updatedProperties = data.updatedProperties;
        if (updatedProperties && updatedProperties.length > 0) {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            for (let i = 0; i < updatedProperties.length; i++) {
              eventsCenter.emit('update-smarty-interaction', updatedProperties[i]);
              eventsCenter.emit('update-interaction', updatedProperties[i]);
            }
          });
        }
        
        // Show success message for completed actions
        toast.success(data.message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      });
    };

    setupSocketListeners();

    /**
     * Fetches game configuration and tasks from the backend API
     * Handles session validation and redirects if session is completed
     */
    const fetchGameConfig = async () => {
      try {
        if (!sessionId) {
          throw new Error('No session ID found');
        }

        const response = await fetch(`/api/game-data?sessionId=${sessionId}`);
        if (!response.ok) {
          const responseData = await response.json();
          if (responseData.error && responseData.session_completed == true) {
            router.push('/finish');
            return;
          }

          throw new Error('Failed to fetch game configuration');
        }

        const data = await response.json();
        setGameConfig(data.gameConfig);
        setTasks(data.tasks);
        setExplanationTrigger(data.gameConfig.explanation.explanation_trigger);
        setAllowUserMessage(data.gameConfig.explanation.allow_user_message || false);
        
        // Notify backend that game has started for this session
        if (socket && socket.connected) {
          socket.emit('game-start', { sessionId });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameConfig();

    /**
     * Set up EventsCenter listeners for communication between React and Phaser
     * Handles game initialization and forwards user interactions to backend
     */
    import('./game/EventsCenter').then(({ eventsCenter }) => {
      // Listen for Phaser game initialization completion
      eventsCenter.on('game-started', () => {
        setGameLoading(false);
      });

      // Forward device interactions from Phaser to backend via WebSocket
      eventsCenter.on('update-interaction-backend', (data:any) => {
        const socket = getSocket();
        if (socket && socket.connected) {
          data.sessionId = sessionId;
          socket.emit('device-interaction', data);
        }
      });

      // Forward general game interactions to backend for logging
      eventsCenter.on('game-interaction', (data: any) => {
        const socket = getSocket();
        if(socket && socket.connected){
          data.sessionId = sessionId;
          socket.emit('game-interaction', data); 
        }
      });
    });

    /**
     * Cleanup function to remove event listeners when component unmounts
     * Prevents memory leaks and duplicate listeners
     */
    return () => {
      socket.off('update-interaction');
      socket.off('explanation');
      socket.off('game-update');
      
      import('./game/EventsCenter').then(({ eventsCenter }) => {
        eventsCenter.off('game-started');
        eventsCenter.off('update-interaction-backend');
        eventsCenter.off('game-interaction');
      });
    };
  }, []);

  /**
   * Callback function to update tasks state when changes occur
   * @param updatedTasks New tasks array from sidebar component
   */
  const handleTasksUpdate = (updatedTasks:any) => {
    setTasks(updatedTasks);
  };

  // Show loading spinner while fetching initial game data
  if (isLoading) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show error message if something went wrong during initialization
  if (error) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
<div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
  {/* Main layout: sidebar and game area arranged horizontally */}
  <div className="flex flex-row items-center justify-center">
    {/* Left sidebar: task management, timer, and controls */}
    <div className="h-full w-64">
      <SmartHomeSidebar 
        explanationTrigger={explanationTrigger} 
        allowUserMessage={allowUserMessage}
        tasks={tasks || []} 
        onTasksUpdate={handleTasksUpdate} 
        currentTaskIndex={currentTaskIndex}
        setCurrentTaskIndex={setCurrentTaskIndex}
      />
    </div>
    
    {/* Game area: Phaser canvas for smart home simulation */}
    <div className="ml-6 h-full">
      {/* Show skeleton loader while Phaser game initializes */}
      {gameLoading && (
        <Skeleton width={768} height={432} />
      )}

      {/* Render Phaser game once configuration is loaded */}
      {gameConfig ? (
        <PhaserGame config={gameConfig} />
      ) : (
        <div className="bg-gray-200 animate-pulse rounded-lg h-[600px] w-[768px]"></div>
      )}
    </div>
  </div>

  {/* Environment bar: displays time and environmental variables */}
  <div className="mt-4" style={{ width: "calc(64rem + 1.5rem)" }}>
    <EnvironmentBar gameConfig={gameConfig} tasks={tasks} currentTaskId={currentTaskIndex} />
  </div>
  
  {/* Toast notification container for explanations and status messages */}
  <ToastContainer 
    position="top-right"
    autoClose={5000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    rtl={false}
    pauseOnFocusLoss
    draggable
    pauseOnHover
    theme="colored"
    transition={Bounce} 
  />
</div>
  );
}