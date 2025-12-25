import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Brain, Check, X, Loader2, Trophy } from "lucide-react";
import { P3 } from "@/lib/sdk";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

const questions: Question[] = [
  {
    id: 1,
    question: "What is the native token of Ethereum?",
    options: ["BTC", "ETH", "SOL", "MATIC"],
    correctIndex: 1,
  },
  {
    id: 2,
    question: "What does 'gas' refer to in blockchain?",
    options: ["Fuel", "Transaction fee", "Mining power", "Block size"],
    correctIndex: 1,
  },
  {
    id: 3,
    question: "What is a smart contract?",
    options: ["Legal document", "Self-executing code", "Wallet type", "Token standard"],
    correctIndex: 1,
  },
];

export default function TriviaTile() {
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSelectOption = (index: number) => {
    if (!answered) {
      setSelectedOption(index);
    }
  };

  const handleAnswer = async () => {
    if (selectedOption === null) {
      toast({
        title: "Select an answer",
        description: "Please choose an option before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAnswered(true);

    const isCorrect = selectedOption === questions[currentQuestion].correctIndex;
    const newScore = isCorrect ? score + 1 : score;
    
    if (isCorrect) {
      setScore(newScore);
    }

    try {
      await P3.proofs.publish("trivia_answer", { 
        questionId: questions[currentQuestion].id, 
        correct: isCorrect, 
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }

    setIsLoading(false);

    toast({
      title: isCorrect ? "Correct!" : "Wrong!",
      description: isCorrect 
        ? "Great job! +1 point" 
        : `The correct answer was: ${questions[currentQuestion].options[questions[currentQuestion].correctIndex]}`,
    });

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setAnswered(false);
      } else {
        setIsComplete(true);
      }
    }, 1500);
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(false);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <Card className="glass-card" data-testid="tile-trivia">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">Quiz Complete!</h3>
            <div className="mb-4">
              <p className="text-3xl font-bold text-emerald-400" data-testid="text-final-score">
                {score} / {questions.length}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {score === questions.length ? "Perfect score!" : score >= 2 ? "Great job!" : "Keep learning!"}
              </p>
            </div>
            <Button
              onClick={handleRestart}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-restart-trivia"
            >
              Play Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card" data-testid="tile-trivia">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600/20">
              <Brain className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Web3 Trivia</h3>
              <p className="text-xs text-slate-400">Test your knowledge</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Score</p>
            <p className="text-lg font-bold text-emerald-400" data-testid="text-current-score">{score}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < currentQuestion ? "bg-emerald-500" : i === currentQuestion ? "bg-emerald-400" : "bg-slate-600"
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="text-white font-medium" data-testid="text-question">
            {questions[currentQuestion].question}
          </p>

          <div className="space-y-2">
            {questions[currentQuestion].options.map((option, index) => {
              const isSelected = selectedOption === index;
              const isCorrect = index === questions[currentQuestion].correctIndex;
              const showResult = answered;

              let buttonClass = "w-full text-left p-3 rounded-lg border transition-all ";
              
              if (showResult) {
                if (isCorrect) {
                  buttonClass += "bg-emerald-600/20 border-emerald-500 text-emerald-400";
                } else if (isSelected && !isCorrect) {
                  buttonClass += "bg-red-600/20 border-red-500 text-red-400";
                } else {
                  buttonClass += "bg-slate-800/50 border-slate-700 text-slate-400";
                }
              } else {
                if (isSelected) {
                  buttonClass += "bg-emerald-600/20 border-emerald-500 text-white";
                } else {
                  buttonClass += "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800";
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  disabled={answered}
                  className={buttonClass}
                  data-testid={`button-option-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {showResult && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                    {showResult && isSelected && !isCorrect && <X className="w-4 h-4 text-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleAnswer}
            disabled={isLoading || answered || selectedOption === null}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="button-submit-answer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : answered ? (
              "Next Question..."
            ) : (
              "Answer"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
