
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { playersTable, gameRoundsTable } from '../db/schema';
import { getGameState } from '../handlers/get_game_state';

describe('getGameState', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty game state when no data exists', async () => {
    const result = await getGameState();

    expect(result.current_round).toBeNull();
    expect(result.time_until_next_round).toBeNull();
    expect(result.leaderboard).toEqual([]);
    expect(result.recent_rounds).toEqual([]);
  });

  it('should return current active round', async () => {
    // Create a player first
    const player = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();

    // Create an active round
    const activeRound = await db.insert(gameRoundsTable)
      .values({
        target_number: 42,
        winner_id: null,
        total_guesses: 5,
        is_active: true
      })
      .returning()
      .execute();

    const result = await getGameState();

    expect(result.current_round).toBeDefined();
    expect(result.current_round?.id).toEqual(activeRound[0].id);
    expect(result.current_round?.target_number).toEqual(42);
    expect(result.current_round?.is_active).toBe(true);
    expect(result.current_round?.winner_id).toBeNull();
    expect(result.current_round?.total_guesses).toEqual(5);
  });

  it('should return leaderboard sorted by wins then streak', async () => {
    // Create players with different stats
    await db.insert(playersTable)
      .values([
        {
          display_name: 'Player A',
          total_wins: 5,
          total_attempts: 10,
          current_streak: 2
        },
        {
          display_name: 'Player B',
          total_wins: 5,
          total_attempts: 8,
          current_streak: 3
        },
        {
          display_name: 'Player C',
          total_wins: 8,
          total_attempts: 15,
          current_streak: 1
        }
      ])
      .execute();

    const result = await getGameState();

    expect(result.leaderboard).toHaveLength(3);
    // Should be sorted by wins desc, then streak desc
    expect(result.leaderboard[0].display_name).toEqual('Player C'); // 8 wins
    expect(result.leaderboard[1].display_name).toEqual('Player B'); // 5 wins, 3 streak
    expect(result.leaderboard[2].display_name).toEqual('Player A'); // 5 wins, 2 streak
  });

  it('should return recent completed rounds with winner names', async () => {
    // Create players
    const players = await db.insert(playersTable)
      .values([
        {
          display_name: 'Winner 1',
          total_wins: 1,
          total_attempts: 5,
          current_streak: 1
        },
        {
          display_name: 'Winner 2',
          total_wins: 2,
          total_attempts: 8,
          current_streak: 2
        }
      ])
      .returning()
      .execute();

    // Create completed rounds
    await db.insert(gameRoundsTable)
      .values([
        {
          target_number: 25,
          winner_id: players[0].id,
          total_guesses: 8,
          is_active: false,
          ended_at: new Date('2024-01-02')
        },
        {
          target_number: 75,
          winner_id: players[1].id,
          total_guesses: 12,
          is_active: false,
          ended_at: new Date('2024-01-01')
        },
        {
          target_number: 50,
          winner_id: null,
          total_guesses: 20,
          is_active: false,
          ended_at: new Date('2024-01-03')
        }
      ])
      .execute();

    const result = await getGameState();

    expect(result.recent_rounds).toHaveLength(3);
    // Should be sorted by ended_at desc (most recent first)
    expect(result.recent_rounds[0].target_number).toEqual(50);
    expect(result.recent_rounds[0].winner_name).toBeNull();
    expect(result.recent_rounds[1].target_number).toEqual(25);
    expect(result.recent_rounds[1].winner_name).toEqual('Winner 1');
    expect(result.recent_rounds[2].target_number).toEqual(75);
    expect(result.recent_rounds[2].winner_name).toEqual('Winner 2');
  });

  it('should handle mixed active and completed rounds correctly', async () => {
    // Create a player
    const player = await db.insert(playersTable)
      .values({
        display_name: 'Mixed Player',
        total_wins: 1,
        total_attempts: 3,
        current_streak: 1
      })
      .returning()
      .execute();

    // Create both active and completed rounds
    await db.insert(gameRoundsTable)
      .values([
        {
          target_number: 30,
          winner_id: null,
          total_guesses: 3,
          is_active: true // Active round
        },
        {
          target_number: 60,
          winner_id: player[0].id,
          total_guesses: 7,
          is_active: false, // Completed round
          ended_at: new Date()
        }
      ])
      .execute();

    const result = await getGameState();

    expect(result.current_round).toBeDefined();
    expect(result.current_round?.target_number).toEqual(30);
    expect(result.current_round?.is_active).toBe(true);

    expect(result.recent_rounds).toHaveLength(1);
    expect(result.recent_rounds[0].target_number).toEqual(60);
    expect(result.recent_rounds[0].is_active).toBe(false);
    expect(result.recent_rounds[0].winner_name).toEqual('Mixed Player');

    expect(result.leaderboard).toHaveLength(1);
    expect(result.leaderboard[0].display_name).toEqual('Mixed Player');
  });
});
