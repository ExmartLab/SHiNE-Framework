import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';

export async function GET(request: Request) {
  try {
    // Get sessionId from the URL search params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    // Find devices and tasks for the given session
    const [devices, tasks] = await Promise.all([
      db.collection('devices').find({ userSessionId: sessionId }).toArray(),
      db.collection('tasks').find({ userSessionId: sessionId }).toArray()
    ]);

    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { error: 'No devices found for this session' },
        { status: 404 }
      );
    }


    // Create a deep copy of gameConfig to avoid modifying the original
    const updatedGameConfig = JSON.parse(JSON.stringify(gameConfig));

    // Update device states in the game configuration
    for (const device of devices) {
      // Find the device in the game configuration
      for (const room of updatedGameConfig.rooms) {
        for (const wall of room.walls) {
          if (!wall.devices) continue;
          
          const gameDevice = wall.devices.find(d => d.id === device.deviceId);
          if (gameDevice) {
            // Update each interaction's current state
            for (const interaction of device.deviceInteraction) {
              const gameInteraction = gameDevice.interactions.find(i => i.name === interaction.name);
              if (gameInteraction) {
                gameInteraction.currentState = {
                  ...gameInteraction.currentState,
                  value: interaction.value
                };
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Game data retrieved successfully',
      gameConfig: updatedGameConfig,
      tasks
    });
  } catch (error){
    console.error('Error retrieving game data:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}