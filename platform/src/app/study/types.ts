/**
 * Study-related type definitions and interfaces
 * Centralized type definitions for the smart home simulation study platform
 */

import { Task } from '@/types/task';

// =====================
// Socket Event Types
// =====================

/**
 * Socket event data for device interaction updates
 */
export interface SocketInteractionUpdate {
  /** Device identifier */
  deviceId: string;
  /** Name of the interaction being updated */
  interaction: string;
  /** New value for the interaction */
  value: unknown;
}

/**
 * Socket event data for explanation responses
 */
export interface SocketExplanation {
  /** HTML content of the explanation */
  explanation: string;
  /** Unique identifier for the explanation */
  explanation_id: string;
  /** Type of rating system to show */
  rating: string;
}

/**
 * Socket event data for game state updates
 */
export interface SocketGameUpdate {
  /** Updated tasks array */
  updatedTasks: Task[];
  /** Additional update data */
  [key: string]: unknown;
}

/**
 * Game interaction event data
 */
export interface GameInteractionEvent {
  /** Type of interaction */
  type: string;
  /** Additional event data */
  data: Record<string, unknown>;
}

// =====================
// Phaser Game Config Types
// =====================

/**
 * Extended Phaser game configuration with custom properties
 */
export interface GameConfig extends Phaser.Types.Core.GameConfig {
  /** Horizontal scaling factor for room elements */
  scaleRoomElementsX: number;
  /** Vertical scaling factor for room elements */
  scaleRoomElementsY: number;
  /** Maximum zoom level for device closeup */
  maxZoom: number;
  /** Duration for zoom/transition animations in ms */
  animDuration: number;
  /** Custom configuration data (rooms, devices, interactions) */
  settings?: Record<string, unknown>;
}

// =====================
// Environment Bar Types
// =====================

/**
 * Props for the EnvironmentBar component
 */
export interface EnvironmentBarProps {
  /** Array of tasks containing environment variables */
  tasks: Task[];
  /** ID of the currently active task */
  currentTaskId: number;
  /** Game configuration object containing time settings */
  gameConfig: GameConfig;
}

// =====================
// Phaser Game Types
// =====================

/**
 * Interface for the PhaserGame component's ref object
 * Provides access to the Phaser game instance and current scene
 */
export interface IRefPhaserGame {
  /** The Phaser game instance */
  game: Phaser.Game | null;
  /** The currently active Phaser scene */
  scene: Phaser.Scene | null;
}

/**
 * Props interface for the PhaserGame component
 */
export interface IPhaserGameProps {
  /** Optional callback when the active scene changes */
  currentActiveScene?: (scene_instance: Phaser.Scene) => void;
  /** Game configuration object containing rooms, devices, and settings */
  config?: GameConfig;
}

// =====================
// Smart Home Sidebar Types
// =====================

/**
 * Props for the SmartHomeSidebar component
 */
export interface SmartHomeSidebarProps {
  /** Array of tasks or null if not loaded */
  tasks: Task[] | null;
  /** Callback when tasks are updated */
  onTasksUpdate: (tasks: Task[]) => void;
  /** Explanation trigger configuration */
  explanationTrigger: string;
  /** Current task index */
  currentTaskIndex: number;
  /** Callback to set current task index */
  setCurrentTaskIndex: (index: number) => void;
  /** Whether user message input is allowed */
  allowUserMessage?: boolean;
  /** Callback to open the abort modal */
  onOpenAbortModal: () => void;
}

// =====================
// Wall Scene Types
// =====================

/**
 * Configuration for preloading images with key-path mapping
 */
export interface PreloadImage {
  /** Unique key for the image asset */
  key: string;
  /** File path to the image */
  path: string;
}

/**
 * Position coordinates for door placement
 */
export interface DoorPosition {
  /** X coordinate on the wall */
  x: number;
  /** Y coordinate on the wall */
  y: number;
}

/**
 * Destination information for door navigation
 */
export interface DoorDestination {
  /** Target room scene key */
  room: string;
  /** Target wall within the room */
  wall: string;
}

/**
 * Complete door configuration with visual and navigation data
 */
export interface Door {
  /** Path to door image asset */
  image: string;
  /** Position where door should be placed */
  position: DoorPosition;
  /** Where the door leads when clicked */
  destination: DoorDestination;
}

/**
 * Configuration data for devices placed on this wall
 */
export interface DeviceConfig {
  /** Device name identifier */
  name: string;
  /** Reference to parent wall (set automatically) */
  parentWall?: string;
  /** Additional device configuration properties */
  [key: string]: unknown;
}

/**
 * Complete wall configuration including background, doors, and devices
 */
export interface WallData {
  /** Parent room scene this wall belongs to */
  parentRoom: string;
  /** Background image for the wall */
  image: string;
  /** Optional doors for navigation to other rooms */
  doors?: Door[];
  /** Optional devices mounted on this wall */
  devices?: DeviceConfig[];
  /** Additional wall properties */
  [key: string]: unknown;
}

/**
 * Data passed when entering device closeup mode
 */
export interface EnterCloseupData {
  /** Current device identifier */
  current_device: string;
  /** Full device scene key */
  device_long_id: string;
  /** Wall containing the device */
  device_wall: string;
  /** Camera zoom information for synchronization */
  zoom_info?: {
    scrollX: number;
    scrollY: number;
    zoomScale: number;
  };
  /** Additional closeup data */
  [key: string]: unknown;
}

// =====================
// Room Scene Types
// =====================

/**
 * Configuration data for a wall within a room
 */
export interface RoomWallData {
  /** Reference to the parent room scene */
  parentRoom?: string;
  /** Whether this wall should be shown by default */
  default?: boolean;
  /** Additional wall properties */
  [key: string]: unknown;
}

/**
 * Configuration data for a room containing multiple walls
 */
export interface RoomData {
  /** Display name of the room */
  name: string;
  /** Array of wall configurations for this room */
  walls: RoomWallData[];
  /** Additional room properties */
  [key: string]: unknown;
}

// =====================
// Device Scene Types
// =====================

/**
 * Represents a position in 2D space with optional scaling and origin settings
 */
export interface Position {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Optional scaling factor */
  scale?: number;
  /** Optional origin point (0-1) */
  origin?: number;
}

/**
 * Defines a condition for visual state evaluation
 */
export interface Condition {
  /** Name of the interaction or variable to check */
  name: string;
  /** Expected value for the condition */
  value: unknown;
  /** Comparison operator (>, <, >=, <=, ==, !=) */
  operator?: string;
}

/**
 * Defines a visual state for the device with conditions and positioning
 */
export interface VisualState {
  /** Path to the image asset for this state */
  image: string;
  /** Whether this is the default state */
  default?: boolean;
  /** Conditions that must be met for this state to be active */
  conditions?: Condition[];
  /** Optional position override for this state */
  position?: Position;
}

/**
 * Internal state representation linking state names to images
 */
export interface State {
  /** State identifier */
  state: string;
  /** Associated image path */
  image: string;
}

/**
 * Current state of an interaction with its value and additional properties
 */
export interface InteractionState {
  /** Current value of the interaction */
  value: unknown;
  /** Additional state properties */
  [key: string]: unknown;
}

/**
 * Device interaction definition with current state
 */
export interface Interaction {
  /** Unique name identifier for the interaction */
  name: string;
  /** Current state of the interaction */
  currentState: InteractionState;
  /** Additional interaction properties */
  [key: string]: unknown;
}

/**
 * Complete device configuration data used for initialization
 */
export interface DeviceData {
  /** Unique device identifier */
  id: string;
  /** ID of the wall scene this device belongs to */
  parentWall: string;
  /** Initial position and scaling */
  position: Position;
  /** Available visual states for the device */
  visualState: VisualState[];
  /** Interactive elements of the device */
  interactions: Interaction[];
}

/**
 * Data structure for updating device interactions
 */
export interface InteractionUpdateData {
  /** Target device ID */
  device: string;
  /** Interaction name to update */
  interaction: string;
  /** New value for the interaction */
  value: unknown;
}