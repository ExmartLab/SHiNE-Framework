import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import gameConfig from '@/game.json';
import { start } from 'node:repl';

export async function GET(request: Request) {
  try {
    

    let devices = [];

    let rooms = gameConfig.rooms;
    let walls = null;

    // Retrieve all devices hierarchically from all walls

    for(let i = 0; i < rooms.length; i++){
      walls = rooms[i].walls;
      for(let j = 0; j < walls.length; j++){
        let deviceArr = walls[j].devices;
        if(deviceArr == undefined)
            continue;
        for(let k = 0; k < deviceArr.length; k++){
          devices.push(deviceArr[k]);
        }
      }
    }

    let userDevice = [];

    let deviceInteraction = [];
    let deviceInteractionValue = null;

    for( let i = 0; i < devices.length; i++){
        deviceInteraction = [];

        for(let j = 0; j < devices[i].interactions.length; j++){

            deviceInteraction.push({
                name: devices[i].interactions[j].name,
                type: devices[i].interactions[j].InteractionType,
                value: devices[i].interactions[j].currentState.value
            });
        }
      
        userDevice.push({
            userSessionId: "",
            deviceId: devices[i].id,
            deviceInteraction: deviceInteraction
        });
        
    }



    return NextResponse.json({
      success: true,
      message: 'Session created successfully',
      userDevice
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}