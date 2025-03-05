"use client"

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import SmartHomeSidebar from './smart-home-sidebar';

const PhaserGame = dynamic(() => import('./game/PhaserGame').then(mod => mod.PhaserGame), {
  ssr: false
})

export default function Home() {
  const [gameConfig, setGameConfig] = useState<any>(null)
  const [tasks, setTasks] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        setIsLoading(false)
      }
    }

    fetchGameConfig()
  }, [])

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
        <SmartHomeSidebar tasks={tasks || []} />
      </div>
      {/* Main content - game area */}
      <div className="ml-6 h-full">
        {gameConfig ? (
          <PhaserGame config={gameConfig} />
        ) : (
          <div className="bg-gray-200 animate-pulse rounded-lg h-[600px] w-[800px]"></div>
        )}
      </div>
    </div>
  );
}
