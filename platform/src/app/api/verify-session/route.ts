import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
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
        { isValid: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is still active (not completed)
    if (session.isCompleted) {
      return NextResponse.json(
        { isValid: false, error: 'Session is completed' },
        { status: 400 }
      );
    }

    // Update last activity time
    await db
      .collection('sessions')
      .updateOne(
        { sessionId },
        { $set: { lastActivity: new Date() } }
      );

    return NextResponse.json({
      isValid: true,
      participantId: session.participantId,
      currentScenario: session.currentScenario,
      experimentGroup: session.experimentGroup
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      { isValid: false, error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}