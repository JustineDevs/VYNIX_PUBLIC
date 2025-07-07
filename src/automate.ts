// First Published by JustineDevs
// This file is the main entry point of the application.

import dotenv from 'dotenv';
import { Bot } from './src/Bot';
import { Logger } from './src/utils/Logger';

// Initialize environment variables
  dotenv.config();

const logger = Logger.getInstance();

/**
 * Main function to instantiate and run the bot.
 */
async function main() {
    logger.info('Application starting...');
    const bot = new Bot();
    await bot.run();
    logger.info('Application has finished its run.');
}

// Execute the main function and catch any unhandled errors.
main().catch((error) => {
    logger.error('A critical error occurred and the application will now exit.', error as Error);
    process.exit(1);
}); 