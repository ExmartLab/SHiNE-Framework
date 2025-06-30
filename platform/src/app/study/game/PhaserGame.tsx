
import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import StartGame from './main';
import { eventsCenter } from './EventsCenter';
import { IRefPhaserGame, IPhaserGameProps } from '../types';

/**
 * React component that integrates Phaser game engine with React
 * Manages the lifecycle of the Phaser game instance and provides access via ref
 */
export const PhaserGame = forwardRef<IRefPhaserGame, IPhaserGameProps>(function PhaserGame({ currentActiveScene, config }, ref)
{
    /** Reference to store the Phaser game instance */
    const game = useRef<Phaser.Game | null>(null!);

    /**
     * Initialize the Phaser game instance when component mounts
     * Uses useLayoutEffect to ensure DOM is ready before game creation
     */
    useLayoutEffect(() =>
    {
        // Only create game if it doesn't already exist
        if (game.current === null)
        {
            // Notify that game initialization has started
            eventsCenter.emit('game-started');
            
            // Create new Phaser game instance with provided configuration
            game.current = StartGame("game-container", config);

            // Expose game instance through ref for parent component access
            if (typeof ref === 'function')
            {
                ref({ game: game.current, scene: null });
            } else if (ref)
            {
                ref.current = { game: game.current, scene: null };
            }
        }

        // Cleanup function to destroy game when component unmounts
        return () =>
        {
            if (game.current)
            {
                // Destroy Phaser game and clean up all resources
                game.current.destroy(true);
                if (game.current !== null)
                {
                    game.current = null;
                }
            }
        }
    }, [ref]);

    /**
     * Render the container div where Phaser will mount the game canvas
     * The id "game-container" matches the parent parameter passed to StartGame
     */
    return (
        <div id="game-container"></div>
    );

});