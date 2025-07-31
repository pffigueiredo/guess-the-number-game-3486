
import { db } from '../db';
import { playersTable } from '../db/schema';
import { type CreatePlayerInput, type Player } from '../schema';
import { eq } from 'drizzle-orm';

export const createPlayer = async (input: CreatePlayerInput): Promise<Player> => {
  try {
    // Check if display name already exists
    const existingPlayers = await db.select()
      .from(playersTable)
      .where(eq(playersTable.display_name, input.display_name))
      .execute();

    if (existingPlayers.length > 0) {
      throw new Error(`Player with display name "${input.display_name}" already exists`);
    }

    // Insert new player record
    const result = await db.insert(playersTable)
      .values({
        display_name: input.display_name,
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Player creation failed:', error);
    throw error;
  }
};
