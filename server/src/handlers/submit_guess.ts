
import { db } from '../db';
import { playersTable, gameRoundsTable, guessesTable } from '../db/schema';
import { type SubmitGuessInput, type GuessResult } from '../schema';
import { eq, and, ne } from 'drizzle-orm';

export async function submitGuess(input: SubmitGuessInput): Promise<GuessResult> {
  try {
    // Find the active round
    const activeRounds = await db.select()
      .from(gameRoundsTable)
      .where(eq(gameRoundsTable.is_active, true))
      .execute();

    if (activeRounds.length === 0) {
      return {
        feedback: 'round_ended',
        is_winner: false,
        round_ended: true
      };
    }

    const activeRound = activeRounds[0];

    // Check if player already guessed in this round
    const existingGuesses = await db.select()
      .from(guessesTable)
      .where(
        and(
          eq(guessesTable.round_id, activeRound.id),
          eq(guessesTable.player_id, input.player_id)
        )
      )
      .execute();

    if (existingGuesses.length > 0) {
      return {
        feedback: 'round_ended',
        is_winner: false,
        round_ended: true
      };
    }

    // Determine if guess is correct
    const isCorrect = input.guess_number === activeRound.target_number;

    // Create guess record
    await db.insert(guessesTable)
      .values({
        round_id: activeRound.id,
        player_id: input.player_id,
        guess_number: input.guess_number,
        is_correct: isCorrect
      })
      .execute();

    // Update total guesses count
    await db.update(gameRoundsTable)
      .set({
        total_guesses: activeRound.total_guesses + 1
      })
      .where(eq(gameRoundsTable.id, activeRound.id))
      .execute();

    // If correct guess, end the round and update player stats
    if (isCorrect) {
      // End the round
      await db.update(gameRoundsTable)
        .set({
          winner_id: input.player_id,
          ended_at: new Date(),
          is_active: false
        })
        .where(eq(gameRoundsTable.id, activeRound.id))
        .execute();

      // Get current player stats
      const players = await db.select()
        .from(playersTable)
        .where(eq(playersTable.id, input.player_id))
        .execute();

      const player = players[0];

      // Update winner's stats
      await db.update(playersTable)
        .set({
          total_wins: player.total_wins + 1,
          total_attempts: player.total_attempts + 1,
          current_streak: player.current_streak + 1
        })
        .where(eq(playersTable.id, input.player_id))
        .execute();

      // Reset other players' streaks (not the winner)
      await db.update(playersTable)
        .set({
          current_streak: 0
        })
        .where(ne(playersTable.id, input.player_id))
        .execute();

      return {
        feedback: 'correct',
        is_winner: true,
        round_ended: true
      };
    }

    // Determine feedback for incorrect guess
    const feedback = input.guess_number > activeRound.target_number ? 'too_high' : 'too_low';

    return {
      feedback,
      is_winner: false,
      round_ended: false
    };
  } catch (error) {
    console.error('Submit guess failed:', error);
    throw error;
  }
}
