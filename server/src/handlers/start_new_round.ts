
import { db } from '../db';
import { gameRoundsTable } from '../db/schema';
import { type GameRound } from '../schema';
import { eq } from 'drizzle-orm';

export const startNewRound = async (): Promise<GameRound> => {
  try {
    // End any currently active rounds
    await db.update(gameRoundsTable)
      .set({
        is_active: false,
        ended_at: new Date()
      })
      .where(eq(gameRoundsTable.is_active, true))
      .execute();

    // Generate random target number between 1-100
    const targetNumber = Math.floor(Math.random() * 100) + 1;

    // Create new round record
    const result = await db.insert(gameRoundsTable)
      .values({
        target_number: targetNumber,
        winner_id: null,
        total_guesses: 0,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to start new round:', error);
    throw error;
  }
};
