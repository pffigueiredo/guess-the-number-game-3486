
import { z } from 'zod';

// Player schema
export const playerSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  total_wins: z.number().int().nonnegative(),
  total_attempts: z.number().int().nonnegative(),
  current_streak: z.number().int().nonnegative(),
  created_at: z.coerce.date()
});

export type Player = z.infer<typeof playerSchema>;

// Game round schema
export const gameRoundSchema = z.object({
  id: z.number(),
  target_number: z.number().int().min(1).max(100),
  winner_id: z.number().nullable(),
  total_guesses: z.number().int().nonnegative(),
  started_at: z.coerce.date(),
  ended_at: z.coerce.date().nullable(),
  is_active: z.boolean()
});

export type GameRound = z.infer<typeof gameRoundSchema>;

// Guess schema
export const guessSchema = z.object({
  id: z.number(),
  round_id: z.number(),
  player_id: z.number(),
  guess_number: z.number().int().min(1).max(100),
  is_correct: z.boolean(),
  created_at: z.coerce.date()
});

export type Guess = z.infer<typeof guessSchema>;

// Input schemas
export const createPlayerInputSchema = z.object({
  display_name: z.string().min(1).max(50).trim()
});

export type CreatePlayerInput = z.infer<typeof createPlayerInputSchema>;

export const submitGuessInputSchema = z.object({
  player_id: z.number(),
  guess_number: z.number().int().min(1).max(100)
});

export type SubmitGuessInput = z.infer<typeof submitGuessInputSchema>;

// Game state schema
export const gameStateSchema = z.object({
  current_round: gameRoundSchema.nullable(),
  time_until_next_round: z.number().nullable(),
  leaderboard: z.array(playerSchema),
  recent_rounds: z.array(gameRoundSchema.extend({
    winner_name: z.string().nullable()
  }))
});

export type GameState = z.infer<typeof gameStateSchema>;

// Guess result schema
export const guessResultSchema = z.object({
  feedback: z.enum(['too_high', 'too_low', 'correct', 'round_ended']),
  is_winner: z.boolean(),
  round_ended: z.boolean()
});

export type GuessResult = z.infer<typeof guessResultSchema>;
