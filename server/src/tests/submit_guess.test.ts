
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { playersTable, gameRoundsTable, guessesTable } from '../db/schema';
import { type SubmitGuessInput } from '../schema';
import { submitGuess } from '../handlers/submit_guess';
import { eq, and } from 'drizzle-orm';

describe('submitGuess', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should submit a correct guess and end the round', async () => {
    // Create a player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();
    const player = playerResult[0];

    // Create an active round
    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 50,
        total_guesses: 0,
        is_active: true
      })
      .returning()
      .execute();
    const round = roundResult[0];

    const input: SubmitGuessInput = {
      player_id: player.id,
      guess_number: 50
    };

    const result = await submitGuess(input);

    expect(result.feedback).toEqual('correct');
    expect(result.is_winner).toBe(true);
    expect(result.round_ended).toBe(true);

    // Verify guess was recorded
    const guesses = await db.select()
      .from(guessesTable)
      .where(eq(guessesTable.round_id, round.id))
      .execute();

    expect(guesses).toHaveLength(1);
    expect(guesses[0].player_id).toEqual(player.id);
    expect(guesses[0].guess_number).toEqual(50);
    expect(guesses[0].is_correct).toBe(true);

    // Verify round was ended
    const updatedRounds = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.id, round.id))
      .execute();

    const updatedRound = updatedRounds[0];
    expect(updatedRound.is_active).toBe(false);
    expect(updatedRound.winner_id).toEqual(player.id);
    expect(updatedRound.ended_at).toBeInstanceOf(Date);
    expect(updatedRound.total_guesses).toEqual(1);

    // Verify player stats were updated
    const updatedPlayers = await db.select()
      .from(playersTable)
      .where(eq(playersTable.id, player.id))
      .execute();

    const updatedPlayer = updatedPlayers[0];
    expect(updatedPlayer.total_wins).toEqual(1);
    expect(updatedPlayer.total_attempts).toEqual(1);
    expect(updatedPlayer.current_streak).toEqual(1);
  });

  it('should provide too_high feedback for high guess', async () => {
    // Create a player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();
    const player = playerResult[0];

    // Create an active round
    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 30,
        total_guesses: 0,
        is_active: true
      })
      .returning()
      .execute();
    const round = roundResult[0];

    const input: SubmitGuessInput = {
      player_id: player.id,
      guess_number: 75
    };

    const result = await submitGuess(input);

    expect(result.feedback).toEqual('too_high');
    expect(result.is_winner).toBe(false);
    expect(result.round_ended).toBe(false);

    // Verify guess was recorded
    const guesses = await db.select()
      .from(guessesTable)
      .where(eq(guessesTable.round_id, round.id))
      .execute();

    expect(guesses).toHaveLength(1);
    expect(guesses[0].is_correct).toBe(false);

    // Verify round is still active
    const activeRounds = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.id, round.id))
      .execute();

    expect(activeRounds[0].is_active).toBe(true);
    expect(activeRounds[0].total_guesses).toEqual(1);
  });

  it('should provide too_low feedback for low guess', async () => {
    // Create a player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();
    const player = playerResult[0];

    // Create an active round
    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 80,
        total_guesses: 0,
        is_active: true
      })
      .returning()
      .execute();
    const round = roundResult[0];

    const input: SubmitGuessInput = {
      player_id: player.id,
      guess_number: 25
    };

    const result = await submitGuess(input);

    expect(result.feedback).toEqual('too_low');
    expect(result.is_winner).toBe(false);
    expect(result.round_ended).toBe(false);

    // Verify guess was recorded
    const guesses = await db.select()
      .from(guessesTable)
      .where(eq(guessesTable.round_id, round.id))
      .execute();

    expect(guesses).toHaveLength(1);
    expect(guesses[0].is_correct).toBe(false);
  });

  it('should return round_ended when no active round exists', async () => {
    // Create a player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();
    const player = playerResult[0];

    const input: SubmitGuessInput = {
      player_id: player.id,
      guess_number: 50
    };

    const result = await submitGuess(input);

    expect(result.feedback).toEqual('round_ended');
    expect(result.is_winner).toBe(false);
    expect(result.round_ended).toBe(true);
  });

  it('should return round_ended when player already guessed in current round', async () => {
    // Create a player
    const playerResult = await db.insert(playersTable)
      .values({
        display_name: 'Test Player',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 0
      })
      .returning()
      .execute();
    const player = playerResult[0];

    // Create an active round
    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 50,
        total_guesses: 1,
        is_active: true
      })
      .returning()
      .execute();
    const round = roundResult[0];

    // Create existing guess
    await db.insert(guessesTable)
      .values({
        round_id: round.id,
        player_id: player.id,
        guess_number: 30,
        is_correct: false
      })
      .execute();

    const input: SubmitGuessInput = {
      player_id: player.id,
      guess_number: 50
    };

    const result = await submitGuess(input);

    expect(result.feedback).toEqual('round_ended');
    expect(result.is_winner).toBe(false);
    expect(result.round_ended).toBe(true);

    // Verify no new guess was created
    const guesses = await db.select()
      .from(guessesTable)
      .where(eq(guessesTable.round_id, round.id))
      .execute();

    expect(guesses).toHaveLength(1); // Only the original guess
  });

  it('should reset other players streaks when someone wins', async () => {
    // Create multiple players
    const player1Result = await db.insert(playersTable)
      .values({
        display_name: 'Winner',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 2
      })
      .returning()
      .execute();
      
    const player2Result = await db.insert(playersTable)
      .values({
        display_name: 'Loser1',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 3
      })
      .returning()
      .execute();

    const player3Result = await db.insert(playersTable)
      .values({
        display_name: 'Loser2',
        total_wins: 0,
        total_attempts: 0,
        current_streak: 1
      })
      .returning()
      .execute();

    const winner = player1Result[0];
    const loser1 = player2Result[0];
    const loser2 = player3Result[0];

    // Create an active round
    const roundResult = await db.insert(gameRoundsTable)
      .values({
        target_number: 42,
        total_guesses: 0,
        is_active: true
      })
      .returning()
      .execute();

    const input: SubmitGuessInput = {
      player_id: winner.id,
      guess_number: 42
    };

    await submitGuess(input);

    // Check winner's stats
    const updatedWinner = await db.select()
      .from(playersTable)
      .where(eq(playersTable.id, winner.id))
      .execute();

    expect(updatedWinner[0].current_streak).toEqual(3); // 2 + 1

    // Check that other players' streaks were reset
    const updatedLoser1 = await db.select()
      .from(playersTable)
      .where(eq(playersTable.id, loser1.id))
      .execute();

    const updatedLoser2 = await db.select()
      .from(playersTable)
      .where(eq(playersTable.id, loser2.id))
      .execute();

    expect(updatedLoser1[0].current_streak).toEqual(0);
    expect(updatedLoser2[0].current_streak).toEqual(0);
  });
});
