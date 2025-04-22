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


const PhaserGame = dynamic(() => import('./game/PhaserGame').then(mod => mod.PhaserGame), {
  ssr: false
})

export default function Home() {
  const router = useRouter();
  const [gameConfig, setGameConfig] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [explanationTrigger, setExplanationTrigger] = useState('automatic');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameLoading, setGameLoading] = useState(true);

  useEffect(() => {
    // Initialize socket once
    const socket = initializeSocket();
    const sessionId = localStorage.getItem('smartHomeSessionId');
    
    if(!sessionId){
      router.push('/');
      return;
    }

    // Set up event listeners for this component
    const setupSocketListeners = () => {
      socket.on('update-interaction', (data:any) => {
        console.log('Received update-interaction:', data);
        const updatedData = {
          device: data.deviceId,
          interaction: data.interaction,
          value: data.value
        };
        
        setTimeout(() => {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            eventsCenter.emit('update-interaction', updatedData);
            eventsCenter.emit('update-smarty-interaction', updatedData);
          });
        }, 300);
      });

      socket.on('explanation', (data:any) => {
        console.log('Received explanation:', data);
        toast.info(data.explanation, {
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

      socket.on('game-update', (data:any) => {
        const updatedTasks = data.updatedTasks;
        setTasks(updatedTasks);
        console.log('Updated tasks:', updatedTasks)

        const updatedProperties = data.updatedProperties;
        if (updatedProperties && updatedProperties.length > 0) {
          import('./game/EventsCenter').then(({ eventsCenter }) => {
            for (let i = 0; i < updatedProperties.length; i++) {
              eventsCenter.emit('update-smarty-interaction', updatedProperties[i]);
              eventsCenter.emit('update-interaction', updatedProperties[i]);
            }
          });
        }
        
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

    const fetchGameConfig = async () => {
      try {
        if (!sessionId) {
          throw new Error('No session ID found');
        }

        const response = await fetch(`/api/game-data?sessionId=${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch game configuration');
        }

        const data = await response.json();
        setGameConfig(data.gameConfig);
        setTasks(data.tasks);
        setExplanationTrigger(data.gameConfig.explanation.explanation_trigger);
        
        // Emit game-start event to notify server that the game has started for this session
        if (socket && socket.connected) {
          console.log('Emitting game-start event with sessionId:', sessionId);  
          socket.emit('game-start', { sessionId });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameConfig();

    // Set up EventsCenter listeners
    import('./game/EventsCenter').then(({ eventsCenter }) => {
      eventsCenter.on('game-started', () => {
        console.log('Game loaded');
        setGameLoading(false);
      });

      eventsCenter.on('update-interaction-backend', (data:any) => {
        // Emit device interactions to other clients
        const socket = getSocket();
        if (socket && socket.connected) {
          data.sessionId = sessionId;
          socket.emit('device-interaction', data);
        }
      });

      eventsCenter.on('game-interaction', (data: any) => {
        const socket = getSocket();
        if(socket && socket.connected){
          data.sessionId = sessionId;
          socket.emit('game-interaction', data); 
        }
      });
    });

    // Cleanup function
    return () => {
      // Remove listeners but don't disconnect the socket
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

  // When component unmounts completely (like navigating away from the app), 
  // use this in a top-level component
  // useEffect(() => {
  //   return () => {
  //     closeSocket();
  //   };
  // }, []);

  const handleTasksUpdate = (updatedTasks:any) => {
    setTasks(updatedTasks);
  };

  if (isLoading) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
<div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
  {/* Top row with sidebar and game area side by side */}
  <div className="flex flex-row items-center justify-center">
    {/* Left sidebar - fixed width of 64px */}
    <div className="h-full w-64">
      <SmartHomeSidebar 
        explanationTrigger={explanationTrigger} 
        tasks={tasks || []} 
        onTasksUpdate={handleTasksUpdate} 
        currentTaskIndex={currentTaskIndex}
        setCurrentTaskIndex={setCurrentTaskIndex}
      />
    </div>
    
    {/* Main content - game area with fixed width of 768px */}
    <div className="ml-6 h-full">
      {gameLoading && (
        <Skeleton width={768} height={432} />
      )}

      {gameConfig ? (
        <PhaserGame config={gameConfig} />
      ) : (
        <div className="bg-gray-200 animate-pulse rounded-lg h-[600px] w-[768px]"></div>
      )}
    </div>
  </div>

  {/* Environment Bar on a new line with width matching the content above (w-64 + ml-6 + w-768) */}
  <div className="mt-4" style={{ width: "calc(64rem + 1.5rem)" }}>
    <EnvironmentBar gameConfig={gameConfig} tasks={tasks} currentTaskId={currentTaskIndex} />
  </div>
  
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