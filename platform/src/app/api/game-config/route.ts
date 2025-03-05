import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET(request: NextRequest) {
    try {
        // Get session ID from query parameters
        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        // Connect to MongoDB
        const client = await MongoClient.connect(process.env.MONGODB_URI || '');
        const db = client.db('smart_home_study');

        // Get session data
        const session = await db.collection('sessions').findOne({ sessionId });

        if (!session) {
            await client.close();
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Get game configuration
        const gameConfig = await db.collection('game_configs').findOne(
            { _id: session.configId || 'default' }
        );

        // Get current device states
        const deviceStates = await db.collection('device_states').find(
            { sessionId: sessionId }
        ).toArray();

        await client.close();

        return NextResponse.json({
            config: gameConfig,
            deviceStates: deviceStates
        });

    } catch (error) {
        console.error('Error fetching game configuration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}