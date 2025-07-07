export interface Session {
    sessionId: string;
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
    finalFeedback?: Record<string, unknown>;
    custom_data?: Record<string, unknown>;  // For data passed via URL parameter
}

export interface ScenarioCompletion {
    scenarioId: number;
    completedAt: Date;
    feedback: Record<string, unknown>;
    deviceInteractions: Record<string, unknown>;
}

export interface Interaction {
    type: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}