
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gameRoundsTable } from '../db/schema';
import { startNewRound } from '../handlers/start_new_round';
import { eq } from 'drizzle-orm';

describe('startNewRound', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new active round', async () => {
    const result = await startNewRound();

    // Verify basic round properties
    expect(result.id).toBeDefined();
    expect(result.target_number).toBeGreaterThanOrEqual(1);
    expect(result.target_number).toBeLessThanOrEqual(100);
    expect(result.winner_id).toBeNull();
    expect(result.total_guesses).toEqual(0);
    expect(result.is_active).toBe(true);
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.ended_at).toBeNull();
  });

  it('should save new round to database', async () => {
    const result = await startNewRound();

    // Query database to verify round was saved
    const rounds = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.id, result.id))
      .execute();

    expect(rounds).toHaveLength(1);
    expect(rounds[0].target_number).toEqual(result.target_number);
    expect(rounds[0].is_active).toBe(true);
    expect(rounds[0].total_guesses).toEqual(0);
    expect(rounds[0].winner_id).toBeNull();
  });

  it('should end existing active rounds when starting new round', async () => {
    // Create first active round
    const firstRound = await db.insert(gameRoundsTable)
      .values({
        target_number: 50,
        winner_id: null,
        total_guesses: 5,
        is_active: true
      })
      .returning()
      .execute();

    // Start new round - this should end the previous one
    const newRound = await startNewRound();

    // Verify first round is now inactive
    const updatedFirstRound = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.id, firstRound[0].id))
      .execute();

    expect(updatedFirstRound[0].is_active).toBe(false);
    expect(updatedFirstRound[0].ended_at).toBeInstanceOf(Date);

    // Verify new round is active
    expect(newRound.is_active).toBe(true);
    expect(newRound.id).not.toEqual(firstRound[0].id);
  });

  it('should handle multiple active rounds correctly', async () => {
    // Create multiple active rounds
    await db.insert(gameRoundsTable)
      .values([
        { target_number: 25, is_active: true },
        { target_number: 75, is_active: true }
      ])
      .execute();

    // Start new round
    const newRound = await startNewRound();

    // Verify all previous rounds are now inactive
    const allRounds = await db.select()
      .from(gameRoundsTable)
      .execute();

    const activeRounds = allRounds.filter(round => round.is_active);
    const inactiveRounds = allRounds.filter(round => !round.is_active);

    expect(activeRounds).toHaveLength(1);
    expect(activeRounds[0].id).toEqual(newRound.id);
    expect(inactiveRounds).toHaveLength(2);
    
    // All inactive rounds should have ended_at timestamp
    inactiveRounds.forEach(round => {
      expect(round.ended_at).toBeInstanceOf(Date);
    });
  });

  it('should work when no existing rounds exist', async () => {
    // Verify no rounds exist initially
    const initialRounds = await db.select()
      .from(gameRoundsTable)
      .execute();
    expect(initialRounds).toHaveLength(0);

    // Start new round
    const result = await startNewRound();

    // Verify round was created successfully
    expect(result.is_active).toBe(true);
    expect(result.target_number).toBeGreaterThanOrEqual(1);
    expect(result.target_number).toBeLessThanOrEqual(100);

    // Verify only one round exists in database
    const finalRounds = await db.select()
      .from(gameRoundsTable)
      .execute();
    expect(finalRounds).toHaveLength(1);
  });
});
