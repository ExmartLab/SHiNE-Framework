"use client"

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import SmartHomeSidebar from './smart-home-sidebar';
// import { eventsCenter } from './game/EventsCenter';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'
import io from 'Socket.IO-client'


const PhaserGame = dynamic(() => import('./game/PhaserGame').then(mod => mod.PhaserGame), {
  ssr: false
})

// const eventsCenter = dynamic(() => import('./game/EventsCenter').then(mod => mod.eventsCenter), {
//   ssr: false
// })

export default function Home() {
  const [gameConfig, setGameConfig] = useState<any>(null)
  const [tasks, setTasks] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameLoading, setGameLoading] = useState(true)

  let socket;


  const socketInitializer = async () => {
    socket = io()

    socket.on('connect', () => {
      console.log('Socket connected')
    })

    // socket.on('device-state-change', (data) => {
    //   console.log('Device state changed:', data)
    //   // Forward the device state change to the game
    //   import('./game/EventsCenter').then(({ eventsCenter }) => {
    //     eventsCenter.emit('update-interaction', data);
    //   });
    // })

    // socket.on('task-state-change', (data) => {
    //   console.log('Task state changed:', data)
    //   // Update tasks when received from other clients
    //   setTasks(data);
    // })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })
  }

  useEffect(() => {
    void socketInitializer();


    const fetchGameConfig = async () => {
      try {
        const sessionId = localStorage.getItem('smartHomeSessionId')
        if (!sessionId) {
          throw new Error('No session ID found')
        }

        const response = await fetch(`/api/game-data?sessionId=${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch game configuration')
        }

        const data = await response.json()
        setGameConfig(data.gameConfig)
        setTasks(data.tasks)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false);
      }
    }

    fetchGameConfig()

    import('./game/EventsCenter').then(({ eventsCenter }) => {
      // eventsCenter.on('update-interaction', (data:any) => {
      //     // console.log(data);
      // })
      eventsCenter.on('game-started', (data:any) => {
        // setIsLoading(false)
        console.log('loaded');
        setGameLoading(false);
        
      })
    });

    return () => {
      // Clean up socket connection when component unmounts
      if (socket) {
        socket.disconnect();
      }
    };

  }, [])

  const handleTasksUpdate = (updatedTasks: any) => {
    setTasks(updatedTasks);
    
    // Broadcast task updates to other clients
    if (socket && socket.connected) {
    }
  };
  
  // // Function to emit device interactions to other clients
  // const emitDeviceInteraction = (data: any) => {
  //   if (socket && socket.connected) {
  //     socket.emit('device-interaction', data);
  //   }
  // };

  if (isLoading) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid items-center justify-items-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-row items-center justify-center min-h-screen w-full bg-white">
      {/* Left sidebar */}
      <div className="h-full">
        <SmartHomeSidebar tasks={tasks || []} onTasksUpdate={handleTasksUpdate} />
      </div>
      {/* Main content - game area */}
      <div className="ml-6 h-full">
        {gameLoading && (
          <Skeleton width={768} height={432}  />
        )}

        {gameConfig ? (
          <PhaserGame config={gameConfig} />
        ) : (
          <div className="bg-gray-200 animate-pulse rounded-lg h-[600px] w-[800px]"></div>
        )}
      </div>
      

    </div>
  );
}
