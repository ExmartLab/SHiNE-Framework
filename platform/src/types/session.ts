export interface Session {
    sessionId: string;
    participantId: string;
    startTime: Date;
    lastActivity: Date;
    experimentGroup: string;
    completedScenarios: ScenarioCompletion[];
    currentScenario: number;
    userAgent: string;
    screenSize: {
        width: number;
        height: number;
    };
    isCompleted: boolean;
    completionTime?: Date;
    interactions: Interaction[];
    finalFeedback?: any;
    custom_data?: any;  // For data passed via URL parameter
}

export interface ScenarioCompletion {
    scenarioId: number;
    completedAt: Date;
    feedback: any;
    deviceInteractions: any;
}

export interface Interaction {
    type: string;
    timestamp: Date;
    data?: any;
}