export interface Task {
  _id: string;
  taskId: string;
  taskDescription: string;
  isCompleted: boolean;
  isAborted: boolean;
  isTimedOut: boolean;
  task_order: number;
  startTime: string;
  endTime: string;
  abortionOptions: string[];
  abortable: boolean;
  environment: Record<string, unknown>;
}