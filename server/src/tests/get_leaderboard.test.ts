
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { playersTable } from '../db/schema';
import { type CreatePlayerInput } from '../schema';
import { getLeaderboard } from '../handlers/get_leaderboard';

// Test player data
const testPlayers = [
  {
    display_name: 'Alice',
    total_wins: 10,
    total_attempts: 15,
    current_streak: 5
  },
  {
    display_name: 'Bob',
    total_wins: 15,
    total_attempts: 20,
    current_streak: 3
  },
  {
    display_name: 'Charlie',
    total_wins: 10,
    total_attempts: 12,
    current_streak: 8
  },
  {
    display_name: 'Diana',
    total_wins: 5,
    total_attempts: 10,
    current_streak: 2
  }
];

describe('getLeaderboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no players exist', async () => {
    const result = await getLeaderboard();
    
    expect(result).toEqual([]);
  });

  it('should return single player', async () => {
    await db.insert(playersTable)
      .values({
        display_name: 'Solo Player',
        total_wins: 5,
        total_attempts: 8,
        current_streak: 3
      })
      .execute();

    const result = await getLeaderboard();
    
    expect(result).toHaveLength(1);
    expect(result[0].display_name).toEqual('Solo Player');
    expect(result[0].total_wins).toEqual(5);
    expect(result[0].total_attempts).toEqual(8);
    expect(result[0].current_streak).toEqual(3);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should order players by total_wins DESC, then current_streak DESC', async () => {
    // Insert test players
    for (const player of testPlayers) {
      await db.insert(playersTable)
        .values(player)
        .execute();
    }

    const result = await getLeaderboard();
    
    expect(result).toHaveLength(4);
    
    // Bob should be first (15 wins)
    expect(result[0].display_name).toEqual('Bob');
    expect(result[0].total_wins).toEqual(15);
    
    // Charlie should be second (10 wins, 8 streak beats Alice's 5 streak)
    expect(result[1].display_name).toEqual('Charlie');
    expect(result[1].total_wins).toEqual(10);
    expect(result[1].current_streak).toEqual(8);
    
    // Alice should be third (10 wins, 5 streak)
    expect(result[2].display_name).toEqual('Alice');
    expect(result[2].total_wins).toEqual(10);
    expect(result[2].current_streak).toEqual(5);
    
    // Diana should be last (5 wins)
    expect(result[3].display_name).toEqual('Diana');
    expect(result[3].total_wins).toEqual(5);
  });

  it('should return all player fields correctly', async () => {
    await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 7,
        total_attempts: 10,
        current_streak: 4
      })
      .execute();

    const result = await getLeaderboard();
    const player = result[0];
    
    expect(player.id).toBeTypeOf('number');
    expect(player.display_name).toEqual('Test Player');
    expect(player.total_wins).toEqual(7);
    expect(player.total_attempts).toEqual(10);
    expect(player.current_streak).toEqual(4);
    expect(player.created_at).toBeInstanceOf(Date);
  });

  it('should handle players with same wins and streak', async () => {
    const sameScorePlayers = [
      {
        display_name: 'Player1',
        total_wins: 10,
        total_attempts: 15,
        current_streak: 5
      },
      {
        display_name: 'Player2',
        total_wins: 10,
        total_attempts: 12,
        current_streak: 5
      }
    ];

    for (const player of sameScorePlayers) {
      await db.insert(playersTable)
        .values(player)
        .execute();
    }

    const result = await getLeaderboard();
    
    expect(result).toHaveLength(2);
    // Both should have same wins and streak, order may vary but both should be present
    expect(result[0].total_wins).toEqual(10);
    expect(result[0].current_streak).toEqual(5);
    expect(result[1].total_wins).toEqual(10);
    expect(result[1].current_streak).toEqual(5);
  });
});
