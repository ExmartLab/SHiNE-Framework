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

    // Get user
    const userSession = await db.collection('sessions').findOne({ sessionId });

    if (!userSession || userSession.isCompleted) {
      return NextResponse.json(
        { error: 'User not found or already completed' },
        { status: 404 }
      );
    }

    // Find and update the session
    const result = await db.collection('sessions').updateOne(
      { sessionId },
      {
        $set: {
          isCompleted: true,
          completionTime: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Study completed successfully'
    });
  } catch (error) {
    console.error('Error completing study:', error);
    return NextResponse.json(
      { error: 'Failed to complete study' },
      { status: 500 }
    );
  }
}