import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { sessionId, interactionType, data } = await request.json();

    if (!sessionId || !interactionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectToDatabase();

    // Record the interaction
    const interaction = {
      type: interactionType,
      timestamp: new Date(),
      data: data || {}
    };

    const result = await db.collection('sessions').updateOne(
      { sessionId },
      {
        $push: { interactions: interaction },
        $set: { lastActivity: new Date() }
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
      message: 'Interaction recorded'
    });
  } catch (error) {
    console.error('Error recording interaction:', error);
    return NextResponse.json(
      { error: 'Failed to record interaction' },
      { status: 500 }
    );
  }
}