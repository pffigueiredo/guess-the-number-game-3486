
import { db } from '../db';
import { gameRoundsTable, playersTable } from '../db/schema';
import { type GameRound } from '../schema';
import { eq, desc, isNotNull } from 'drizzle-orm';

export async function getRoundHistory(): Promise<Array<GameRound & { winner_name: string | null }>> {
  try {
    // Get recent completed rounds with winner information
    const results = await db.select({
      id: gameRoundsTable.id,
      target_number: gameRoundsTable.target_number,
      winner_id: gameRoundsTable.winner_id,
      total_guesses: gameRoundsTable.total_guesses,
      started_at: gameRoundsTable.started_at,
      ended_at: gameRoundsTable.ended_at,
      is_active: gameRoundsTable.is_active,
      winner_name: playersTable.display_name
    })
    .from(gameRoundsTable)
    .leftJoin(playersTable, eq(gameRoundsTable.winner_id, playersTable.id))
    .where(isNotNull(gameRoundsTable.ended_at))
    .orderBy(desc(gameRoundsTable.ended_at))
    .limit(10)
    .execute();

    return results;
  } catch (error) {
    console.error('Failed to get round history:', error);
    throw error;
  }
}
