
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

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

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
    .query(() => getGameState()),

  startNewRound: publicProcedure
    .mutation(() => startNewRound()),

  // Guessing
  submitGuess: publicProcedure
    .input(submitGuessInputSchema)
    .mutation(({ input }) => submitGuess(input)),

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
}

start();
