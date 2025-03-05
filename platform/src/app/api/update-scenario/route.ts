import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, scenarioId, feedback, deviceInteractions } = body;

    if (!sessionId || !scenarioId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    // Find the session
    const session = await db
      .collection('sessions')
      .findOne({ sessionId });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Create scenario completion record
    const scenarioCompletion = {
      scenarioId,
      completedAt: new Date(),
      feedback,
      deviceInteractions
    };

    // Update session with completed scenario and move to next scenario
    await db.collection('sessions').updateOne(
      { sessionId },
      {
        $push: { completedScenarios: scenarioCompletion },
        $set: { 
          currentScenario: scenarioId + 1,
          lastActivity: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Scenario updated successfully',
      nextScenario: scenarioId + 1
    });
  } catch (error) {
    console.error('Error updating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to update scenario' },
      { status: 500 }
    );
  }
}