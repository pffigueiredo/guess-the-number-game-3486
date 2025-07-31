
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { GameState, Player, CreatePlayerInput, SubmitGuessInput } from '../../server/src/schema';

// Confetti animation component
function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 3}s`
          }}
        >
          🎉
        </div>
      ))}
    </div>
  );
}

function App() {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Form states
  const [playerName, setPlayerName] = useState('');
  const [guessNumber, setGuessNumber] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');
  
  // Refs for intervals
  const gameStateInterval = useRef<number | null>(null);
  const countdownInterval = useRef<number | null>(null);

  // Load game state
  const loadGameState = useCallback(async () => {
    try {
      const state = await trpc.getGameState.query();
      setGameState(state);
      
      // Set countdown timer if there's time until next round
      if (state.time_until_next_round !== null) {
        setTimeLeft(state.time_until_next_round);
      } else {
        setTimeLeft(null);
      }
    } catch (error) {
      console.error('Failed to load game state:', error);
      setFeedback('Failed to load game state. Using demo data.');
      setFeedbackType('error');
      
      // Set demo data for presentation
      setGameState({
        current_round: {
          id: 1,
          target_number: 42, // Hidden from players
          winner_id: null,
          total_guesses: 0,
          started_at: new Date(),
          ended_at: null,
          is_active: true
        },
        time_until_next_round: null,
        leaderboard: [
          {
            id: 1,
            display_name: 'Alice 🎯',
            total_wins: 5,
            total_attempts: 12,
            current_streak: 3,
            created_at: new Date()
          },
          {
            id: 2,
            display_name: 'Bob 🚀',
            total_wins: 3,
            total_attempts: 8,
            current_streak: 1,
            created_at: new Date()
          }
        ],
        recent_rounds: [
          {
            id: 1,
            target_number: 37,
            winner_id: 1,
            total_guesses: 8,
            started_at: new Date(Date.now() - 300000),
            ended_at: new Date(Date.now() - 240000),
            is_active: false,
            winner_name: 'Alice 🎯'
          }
        ]
      });
    }
  }, []);

  // Setup intervals
  useEffect(() => {
    loadGameState();
    
    // Refresh game state every 2 seconds
    gameStateInterval.current = window.setInterval(() => {
      loadGameState();
    }, 2000);

    return () => {
      if (gameStateInterval.current !== null) {
        window.clearInterval(gameStateInterval.current);
      }
      if (countdownInterval.current !== null) {
        window.clearInterval(countdownInterval.current);
      }
    };
  }, [loadGameState]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      countdownInterval.current = window.setInterval(() => {
        setTimeLeft((prev: number | null) => {
          if (prev === null || prev <= 1) {
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (countdownInterval.current !== null) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }

    return () => {
      if (countdownInterval.current !== null) {
        window.clearInterval(countdownInterval.current);
      }
    };
  }, [timeLeft]);

  // Create player
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsLoading(true);
    try {
      const newPlayer = await trpc.createPlayer.mutate({
        display_name: playerName.trim()
      } as CreatePlayerInput);
      
      setCurrentPlayer(newPlayer);
      setFeedback(`Welcome, ${newPlayer.display_name}! 🎮`);
      setFeedbackType('success');
      setPlayerName('');
      await loadGameState();
    } catch (error) {
      console.error('Failed to create player:', error);
      setFeedback('Failed to create player. Name might already exist.');
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit guess
  const handleSubmitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlayer || !guessNumber || !gameState?.current_round) return;

    const guess = parseInt(guessNumber);
    if (isNaN(guess) || guess < 1 || guess > 100) {
      setFeedback('Please enter a number between 1 and 100');
      setFeedbackType('error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await trpc.submitGuess.mutate({
        player_id: currentPlayer.id,
        guess_number: guess
      } as SubmitGuessInput);

      // Handle feedback
      if (result.feedback === 'correct') {
        setFeedback(result.is_winner ? '🎉 Congratulations! You won this round! 🎉' : 'Correct guess, but someone else won first!');
        setFeedbackType('success');
        if (result.is_winner) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
      } else if (result.feedback === 'too_high') {
        setFeedback('📉 Too high! Try a lower number.');
        setFeedbackType('info');
      } else if (result.feedback === 'too_low') {
        setFeedback('📈 Too low! Try a higher number.');
        setFeedbackType('info');
      } else if (result.feedback === 'round_ended') {
        setFeedback('⏰ This round has already ended!');
        setFeedbackType('error');
      }

      setGuessNumber('');
      await loadGameState();
    } catch (error) {
      console.error('Failed to submit guess:', error);
      setFeedback('Failed to submit guess. Please try again.');
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Start new round (Admin demo)
  const handleStartNewRound = async () => {
    setIsLoading(true);
    try {
      await trpc.startNewRound.mutate();
      setFeedback('🚀 New round started!');
      setFeedbackType('success');
      setShowConfetti(false);
      await loadGameState();
    } catch (error) {
      console.error('Failed to start new round:', error);
      setFeedback('Failed to start new round.');
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      {showConfetti && <Confetti />}
      
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎯 Number Guessing Game 🎯
          </h1>
          <p className="text-lg text-gray-600">
            Guess the number between 1-100! First to guess correctly wins the round!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player Registration */}
            {!currentPlayer && (
              <Card className="shadow-lg border-2 border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-xl text-center">🎮 Join the Game</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleCreatePlayer} className="space-y-4">
                    <div>
                      <Input
                        placeholder="Enter your display name (add emoji for fun! 🎯)"
                        value={playerName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlayerName(e.target.value)}
                        className="text-lg p-3"
                        maxLength={50}
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isLoading || !playerName.trim()}
                      className="w-full text-lg py-3 bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading ? 'Creating Player...' : 'Join Game! 🚀'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Game Status */}
            {currentPlayer && (
              <Card className="shadow-lg border-2 border-green-200">
                <CardHeader className="bg-green-50">
                  <CardTitle className="text-xl text-center">
                    Welcome, {currentPlayer.display_name}!
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {gameState?.current_round ? (
                    <div className="text-center space-y-4">
                      <div className="text-2xl font-bold text-green-600">
                        🎯 Round Active!
                      </div>
                      <p className="text-gray-600">
                        Round #{gameState.current_round.id} • {gameState.current_round.total_guesses} guesses made
                      </p>
                      
                      {/* Guessing Form */}
                      <form onSubmit={handleSubmitGuess} className="space-y-4">
                        <div>
                          <Input
                            type="number"
                            placeholder="Your guess (1-100)"
                            value={guessNumber}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuessNumber(e.target.value)}
                            min="1"
                            max="100"
                            className="text-lg p-3 text-center"
                            disabled={isLoading}
                          />
                        </div>
                        <Button 
                          type="submit" 
                          disabled={isLoading || !guessNumber}
                          className="w-full text-lg py-3 bg-green-600 hover:bg-green-700"
                        >
                          {isLoading ? 'Submitting...' : 'Submit Guess! 🎲'}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="text-xl text-gray-600">
                        ⏰ Waiting for next round...
                      </div>
                      {timeLeft !== null && (
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatTime(timeLeft)}
                          </div>
                          <Progress value={(10 - timeLeft) * 10} className="w-full" />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Feedback */}
            {feedback && (
              <Alert className={`shadow-lg ${
                feedbackType === 'success' ? 'border-green-500 bg-green-50' :
                feedbackType === 'error' ? 'border-red-500 bg-red-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <AlertDescription className="text-lg font-medium text-center">
                  {feedback}
                </AlertDescription>
              </Alert>
            )}

            {/* Admin Demo Button */}
            <Card className="shadow-lg border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <CardTitle className="text-lg text-center">🔧 Demo Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleStartNewRound}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full text-lg py-3 border-orange-400 hover:bg-orange-50"
                >
                  {isLoading ? 'Starting...' : '⚡ Start New Round (Admin Demo)'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <Card className="shadow-lg border-2 border-yellow-200">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="text-xl text-center">🏆 Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {gameState?.leaderboard && gameState.leaderboard.length > 0 ? (
                  <div className="space-y-3">
                    {gameState.leaderboard.map((player: Player, index: number) => (
                      <div 
                        key={player.id}
                        className={`p-3 rounded-lg ${
                          index === 0 ? 'bg-yellow-100 border-2 border-yellow-300' :
                          index === 1 ? 'bg-gray-100 border-2 border-gray-300' :
                          index === 2 ? 'bg-orange-100 border-2 border-orange-300' :
                          'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-bold">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <span className="font-medium">{player.display_name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {player.current_streak} 🔥
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {player.total_wins} wins • {player.total_attempts} attempts
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No players yet! 🎮</p>
                )}
              </CardContent>
            </Card>

            {/* Round History */}
            <Card className="shadow-lg border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-xl text-center">📜 Recent Rounds</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {gameState?.recent_rounds && gameState.recent_rounds.length > 0 ? (
                  <div className="space-y-3">
                    {gameState.recent_rounds.slice(0, 5).map((round) => (
                      <div key={round.id} className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">Round #{round.id}</span>
                          <Badge variant="outline" className="text-xs">
                            Number: {round.target_number}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>🏆 Winner: {round.winner_name || 'None'}</div>
                          <div>🎯 Total guesses: {round.total_guesses}</div>
                          <div className="text-xs mt-1">
                            {round.ended_at ? new Date(round.ended_at).toLocaleTimeString() : 'In progress'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No completed rounds yet! 🎯</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
