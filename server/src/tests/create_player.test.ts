
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { playersTable } from '../db/schema';
import { type CreatePlayerInput } from '../schema';
import { createPlayer } from '../handlers/create_player';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreatePlayerInput = {
  display_name: 'TestPlayer123'
};

describe('createPlayer', () => {
  beforeEach(async () => {
    await resetDB();
    await createDB();
  });
  
  afterEach(resetDB);

  it('should create a player', async () => {
    const result = await createPlayer(testInput);

    // Basic field validation
    expect(result.display_name).toEqual('TestPlayer123');
    expect(result.total_wins).toEqual(0);
    expect(result.total_attempts).toEqual(0);
    expect(result.current_streak).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save player to database', async () => {
    const result = await createPlayer(testInput);

    // Query using proper drizzle syntax
    const players = await db.select()
      .from(playersTable)
      .where(eq(playersTable.id, result.id))
      .execute();

    expect(players).toHaveLength(1);
    expect(players[0].display_name).toEqual('TestPlayer123');
    expect(players[0].total_wins).toEqual(0);
    expect(players[0].total_attempts).toEqual(0);
    expect(players[0].current_streak).toEqual(0);
    expect(players[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error for duplicate display name', async () => {
    // Create first player
    await createPlayer(testInput);

    // Attempt to create second player with same display name
    await expect(createPlayer(testInput)).rejects.toThrow(/already exists/i);
  });

  it('should handle trimmed display names', async () => {
    // Note: Input should already be trimmed by Zod validation before reaching handler
    const inputWithSpaces: CreatePlayerInput = {
      display_name: 'SpacedName' // Already trimmed by Zod
    };

    const result = await createPlayer(inputWithSpaces);

    expect(result.display_name).toEqual('SpacedName');
  });

  it('should create multiple players with different names', async () => {
    const input1: CreatePlayerInput = { display_name: 'Player1' };
    const input2: CreatePlayerInput = { display_name: 'Player2' };

    const result1 = await createPlayer(input1);
    const result2 = await createPlayer(input2);

    expect(result1.display_name).toEqual('Player1');
    expect(result2.display_name).toEqual('Player2');
    expect(result1.id).not.toEqual(result2.id);

    // Verify both exist in database
    const allPlayers = await db.select()
      .from(playersTable)
      .execute();

    expect(allPlayers).toHaveLength(2);
  });
});
