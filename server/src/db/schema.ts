
import { serial, text, pgTable, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const playersTable = pgTable('players', {
  id: serial('id').primaryKey(),
  display_name: text('display_name').notNull().unique(),
  total_wins: integer('total_wins').notNull().default(0),
  total_attempts: integer('total_attempts').notNull().default(0),
  current_streak: integer('current_streak').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const gameRoundsTable = pgTable('game_rounds', {
  id: serial('id').primaryKey(),
  target_number: integer('target_number').notNull(),
  winner_id: integer('winner_id'),
  total_guesses: integer('total_guesses').notNull().default(0),
  started_at: timestamp('started_at').defaultNow().notNull(),
  ended_at: timestamp('ended_at'),
  is_active: boolean('is_active').notNull().default(true),
});

export const guessesTable = pgTable('guesses', {
  id: serial('id').primaryKey(),
  round_id: integer('round_id').notNull(),
  player_id: integer('player_id').notNull(),
  guess_number: integer('guess_number').notNull(),
  is_correct: boolean('is_correct').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const playersRelations = relations(playersTable, ({ many }) => ({
  guesses: many(guessesTable),
  wonRounds: many(gameRoundsTable),
}));

export const gameRoundsRelations = relations(gameRoundsTable, ({ one, many }) => ({
  winner: one(playersTable, {
    fields: [gameRoundsTable.winner_id],
    references: [playersTable.id],
  }),
  guesses: many(guessesTable),
}));

export const guessesRelations = relations(guessesTable, ({ one }) => ({
  player: one(playersTable, {
    fields: [guessesTable.player_id],
    references: [playersTable.id],
  }),
  round: one(gameRoundsTable, {
    fields: [guessesTable.round_id],
    references: [gameRoundsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Player = typeof playersTable.$inferSelect;
export type NewPlayer = typeof playersTable.$inferInsert;
export type GameRound = typeof gameRoundsTable.$inferSelect;
export type NewGameRound = typeof gameRoundsTable.$inferInsert;
export type Guess = typeof guessesTable.$inferSelect;
export type NewGuess = typeof guessesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = { 
  players: playersTable, 
  gameRounds: gameRoundsTable, 
  guesses: guessesTable 
};
