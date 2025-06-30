/**
 * API Route: Complete Study
 * 
 * Marks a study session as completed when all tasks are finished.
 * Updates the session record with completion status and timestamp.
 * Called by the frontend when the user has completed all assigned tasks.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * POST /api/complete-study
 * 
 * Completes a study session by marking it as finished in the database.
 * This endpoint is called when all tasks in a session have been completed,
 * aborted, or timed out, indicating the study is over.
 * 
 * @param request - HTTP request containing sessionId in JSON body
 * @returns JSON response with success/error status
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    // Validate required parameters
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify session exists and is not already completed
    const userSession = await db.collection('sessions').findOne({ sessionId });

    if (!userSession || userSession.isCompleted) {
      return NextResponse.json(
        { error: 'User not found or already completed' },
        { status: 404 }
      );
    }

    // Mark session as completed with timestamp
    const result = await db.collection('sessions').updateOne(
      { sessionId },
      {
        $set: {
          isCompleted: true,
          completionTime: new Date()
        }
      }
    );

    // Verify the update was successful
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