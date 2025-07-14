/**
 * API Route: Verify Session
 * 
 * Validates that a study session exists and is still active.
 * Used to check session validity when users return to the platform
 * or when verifying existing sessions from localStorage.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * POST /api/verify-session
 * 
 * Validates a study session and updates activity tracking.
 * Checks if the session exists, is not completed, and updates
 * the last activity timestamp for session monitoring.
 * 
 * @param request - HTTP request containing sessionId in JSON body
 * @returns JSON response with session validity and status information
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    // Validate required parameters
    if (!sessionId || sessionId === null || sessionId === undefined) {
      return NextResponse.json(
        { isValid: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Look up session record in database
    const session = await db
      .collection('sessions')
      .findOne({ sessionId });

    // Check if session exists
    if (!session) {
      return NextResponse.json(
        { isValid: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify session is still active (not completed)
    if (session.isCompleted) {
      return NextResponse.json(
        { isValid: false, error: 'Session is completed' },
        { status: 400 }
      );
    }

    // Track user activity by updating last activity timestamp
    await db
      .collection('sessions')
      .updateOne(
        { sessionId },
        { $set: { lastActivity: new Date() } }
      );

    return NextResponse.json({
      isValid: true,
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