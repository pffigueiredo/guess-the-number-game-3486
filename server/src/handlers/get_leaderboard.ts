
import { db } from '../db';
import { playersTable } from '../db/schema';
import { type Player } from '../schema';
import { desc } from 'drizzle-orm';

export async function getLeaderboard(): Promise<Player[]> {
  try {
    const results = await db.select()
      .from(playersTable)
      .orderBy(desc(playersTable.total_wins), desc(playersTable.current_streak))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    throw error;
  }
}
