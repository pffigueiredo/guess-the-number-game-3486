
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

import { createPlayerInputSchema, submitGuessInputSchema } from './schema';
import { createPlayer } from './handlers/create_player';
import { getGameState } from './handlers/get_game_state';
import { submitGuess } from './handlers/submit_guess';
import { startNewRound } from './handlers/start_new_round';
import { getLeaderboard } from './handlers/get_leaderboard';
import { getRoundHistory } from './handlers/get_round_history';

// Global timer state
let nextRoundStartTime: Date | null = null;
let roundTimer: ReturnType<typeof setTimeout> | null = null;

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Timer management functions
function scheduleNextRound() {
  // Clear existing timer
  if (roundTimer) {
    clearTimeout(roundTimer);
  }
  
  // Set next round start time to 60 seconds from now
  nextRoundStartTime = new Date(Date.now() + 60000);
  
  // Schedule the round to start in 60 seconds
  roundTimer = setTimeout(async () => {
    try {
      console.log('Starting automatic new round...');
      await startNewRound();
      nextRoundStartTime = null;
      scheduleNextRound(); // Schedule the next round
    } catch (error) {
      console.error('Failed to start automatic round:', error);
      // Retry in 10 seconds if failed
      setTimeout(() => scheduleNextRound(), 10000);
    }
  }, 60000);
  
  console.log(`Next round scheduled for: ${nextRoundStartTime.toISOString()}`);
}

// Function to handle round end and start scheduling
function onRoundEnd() {
  // When a round ends (due to correct guess), schedule the next round
  scheduleNextRound();
}

function getTimeUntilNextRound(): number | null {
  if (!nextRoundStartTime) return null;
  const now = Date.now();
  const timeUntil = Math.max(0, Math.ceil((nextRoundStartTime.getTime() - now) / 1000));
  return timeUntil;
}

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Player management
  createPlayer: publicProcedure
    .input(createPlayerInputSchema)
    .mutation(({ input }) => createPlayer(input)),

  // Game state and rounds
  getGameState: publicProcedure
    .query(() => getGameState(getTimeUntilNextRound)),

  startNewRound: publicProcedure
    .mutation(async () => {
      const result = await startNewRound();
      // Reset the timer when manually starting a round
      nextRoundStartTime = null;
      if (roundTimer) {
        clearTimeout(roundTimer);
      }
      scheduleNextRound();
      return result;
    }),

  // Guessing
  submitGuess: publicProcedure
    .input(submitGuessInputSchema)
    .mutation(async ({ input }) => {
      const result = await submitGuess(input);
      // If the round ended due to a correct guess, schedule the next round
      if (result.round_ended && result.is_winner) {
        onRoundEnd();
      }
      return result;
    }),

  // Leaderboard and history
  getLeaderboard: publicProcedure
    .query(() => getLeaderboard()),

  getRoundHistory: publicProcedure
    .query(() => getRoundHistory()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
  
  // Start the automatic round timer system
  scheduleNextRound();
  console.log('Automatic round timer system started');
}

start();
