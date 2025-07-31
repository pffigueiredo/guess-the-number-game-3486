
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { playersTable, gameRoundsTable } from '../db/schema';
import { getRoundHistory } from '../handlers/get_round_history';

describe('getRoundHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no completed rounds exist', async () => {
    const result = await getRoundHistory();
    expect(result).toEqual([]);
  });

  it('should return completed rounds with winner information', async () => {
    // Create test player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 1,
        total_attempts: 5,
        current_streak: 1
      })
      .returning()
      .execute();

    const playerId = playerResult[0].id;

    // Create completed round with winner
    const completedAt = new Date();
    const startedAt = new Date(completedAt.getTime() - 300000); // 5 minutes earlier

    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 42,
        winner_id: playerId,
        total_guesses: 3,
        started_at: startedAt,
        ended_at: completedAt,
        is_active: false
      })
      .returning()
      .execute();

    const result = await getRoundHistory();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(roundResult[0].id);
    expect(result[0].target_number).toEqual(42);
    expect(result[0].winner_id).toEqual(playerId);
    expect(result[0].winner_name).toEqual('Test Player');
    expect(result[0].total_guesses).toEqual(3);
    expect(result[0].started_at).toBeInstanceOf(Date);
    expect(result[0].ended_at).toBeInstanceOf(Date);
    expect(result[0].is_active).toBe(false);
  });

  it('should return completed rounds without winner', async () => {
    // Create completed round without winner
    const completedAt = new Date();
    const startedAt = new Date(completedAt.getTime() - 300000);

    await db.insert(gameRoundsTable)
      .values({
        target_number: 75,
        winner_id: null,
        total_guesses: 0,
        started_at: startedAt,
        ended_at: completedAt,
        is_active: false
      })
      .returning()
      .execute();

    const result = await getRoundHistory();

    expect(result).toHaveLength(1);
    expect(result[0].target_number).toEqual(75);
    expect(result[0].winner_id).toBeNull();
    expect(result[0].winner_name).toBeNull();
    expect(result[0].total_guesses).toEqual(0);
  });

  it('should exclude active rounds', async () => {
    // Create active round
    await db.insert(gameRoundsTable)
      .values({
        target_number: 33,
        winner_id: null,
        total_guesses: 2,
        is_active: true,
        ended_at: null
      })
      .returning()
      .execute();

    const result = await getRoundHistory();
    expect(result).toEqual([]);
  });

  it('should order rounds by ended_at DESC', async () => {
    // Create two completed rounds with different end times
    const now = new Date();
    const earlier = new Date(now.getTime() - 600000); // 10 minutes earlier
    const later = new Date(now.getTime() - 300000); // 5 minutes earlier

    await db.insert(gameRoundsTable)
      .values([
        {
          target_number: 10,
          winner_id: null,
          total_guesses: 1,
          started_at: new Date(earlier.getTime() - 300000),
          ended_at: earlier,
          is_active: false
        },
        {
          target_number: 20,
          winner_id: null,
          total_guesses: 2,
          started_at: new Date(later.getTime() - 300000),
          ended_at: later,
          is_active: false
        }
      ])
      .returning()
      .execute();

    const result = await getRoundHistory();

    expect(result).toHaveLength(2);
    expect(result[0].target_number).toEqual(20); // More recent round first
    expect(result[1].target_number).toEqual(10); // Older round second
    expect(result[0].ended_at! > result[1].ended_at!).toBe(true);
  });

  it('should limit results to 10 rounds', async () => {
    // Create 12 completed rounds
    const rounds = [];
    const baseTime = new Date();

    for (let i = 0; i < 12; i++) {
      rounds.push({
        target_number: i + 1,
        winner_id: null,
        total_guesses: 1,
        started_at: new Date(baseTime.getTime() - (12 - i) * 60000), // Earlier start times for earlier rounds
        ended_at: new Date(baseTime.getTime() - (12 - i - 1) * 60000), // More recent end times for later rounds
        is_active: false
      });
    }

    await db.insert(gameRoundsTable)
      .values(rounds)
      .returning()
      .execute();

    const result = await getRoundHistory();

    expect(result).toHaveLength(10);
    // Should get the 10 most recent rounds (target_numbers 12 down to 3)
    // Round with target_number 12 has the most recent ended_at time
    expect(result[0].target_number).toEqual(12);
    expect(result[9].target_number).toEqual(3);
  });
});
