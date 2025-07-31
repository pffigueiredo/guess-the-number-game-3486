
import { db } from '../db';
import { playersTable, gameRoundsTable } from '../db/schema';
import { type GameState } from '../schema';
import { eq, desc, isNull, isNotNull } from 'drizzle-orm';

export async function getGameState(getTimeUntilNextRound?: () => number | null): Promise<GameState> {
  try {
    // Get current active round
    const activeRounds = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.is_active, true))
      .execute();

    const currentRound = activeRounds.length > 0 ? activeRounds[0] : null;

    // Get leaderboard sorted by total_wins desc, then by current_streak desc
    const leaderboard = await db.select()
      .from(playersTable)
      .orderBy(desc(playersTable.total_wins), desc(playersTable.current_streak))
      .execute();

    // Get recent completed rounds with winner information
    const recentRoundsQuery = db.select({
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
      .where(eq(gameRoundsTable.is_active, false))
      .orderBy(desc(gameRoundsTable.ended_at))
      .limit(10)
      .execute();

    const recentRounds = await recentRoundsQuery;

    // Format recent rounds to match schema
    const formattedRecentRounds = recentRounds.map(result => ({
      id: result.id,
      target_number: result.target_number,
      winner_id: result.winner_id,
      total_guesses: result.total_guesses,
      started_at: result.started_at,
      ended_at: result.ended_at,
      is_active: result.is_active,
      winner_name: result.winner_name
    }));

    // Calculate time until next round
    const timeUntilNextRound = currentRound 
      ? null // If there's an active round, no countdown
      : getTimeUntilNextRound ? getTimeUntilNextRound() : null;

    return {
      current_round: currentRound,
      time_until_next_round: timeUntilNextRound,
      leaderboard,
      recent_rounds: formattedRecentRounds
    };
  } catch (error) {
    console.error('Failed to get game state:', error);
    throw error;
  }
}
