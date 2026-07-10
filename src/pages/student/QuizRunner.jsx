import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import Lottie from "lottie-react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// Utilities
const getSessionId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;
const getQuestions = (quiz) => Array.isArray(quiz?.questions) ? quiz.questions : [];
const getQuestionId = (question, index) => question?.questionId || question?.id || `question-${index}`;
const getQuestionName = (_question, index) => `q_${index + 1}`;
const getQuestionText = (question, index) => (
  question?.questionText || question?.text || question?.prompt || `Question ${index + 1}`
);

const getOptionValue = (option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return String(option);
  }
  return String(option?.value ?? option?.id ?? option?.text ?? option?.label ?? '');
};

const getOptionLabel = (option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return String(option);
  }
  return String(option?.text ?? option?.label ?? option?.value ?? option?.id ?? '');
};

const getQuestionChoices = (question) => {
  const rawOptions = Array.isArray(question?.options) && question.options.length
    ? question.options
    : ['TRUE_FALSE', 'BOOLEAN'].includes(String(question?.type || question?.questionType || '').toUpperCase())
      ? ['True', 'False']
      : [];

  return rawOptions
    .map((option) => ({
      value: getOptionValue(option),
      text: getOptionLabel(option),
    }))
    .filter((option) => option.value);
};

export default function QuizRunner({ quiz, onSubmit, submitting = false }) {
  const [answers, setAnswers] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [lottieData, setLottieData] = useState(null);
  
  const questions = getQuestions(quiz);
  const quizSessionId = getSessionId(quiz);

  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const canSubmit = useMemo(() => {
    return Boolean(quizSessionId && questions.length && questions.every((q, index) => answers[getQuestionName(q, index)]));
  }, [answers, questions, quizSessionId]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    
    // Show Lottie success animation shortly before passing upstream
    setShowSuccess(true);
    
    const payload = {
      answers: questions.map((question, index) => ({
        questionId: getQuestionId(question, index),
        selectedAnswer: answers[getQuestionName(question, index)],
      })),
    };

    // Small delay to let the animation play
    setTimeout(() => {
      onSubmit?.(quizSessionId, payload);
    }, 1800);
  };

  const handleAnswerChange = (questionName, value) => {
    setAnswers(prev => ({ ...prev, [questionName]: value }));
  };

  if (!quiz) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12 font-sans">
      <Card className="bg-card text-card-foreground shadow-sm border-b-4 border-b-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            {quiz.title || 'Practice quiz'}
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            Answers are hidden until you submit. Quiz ID: {quizSessionId || 'new session'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm font-semibold text-primary">{answeredCount} of {questions.length} answered</span>
            <Progress value={progressPercent} className="flex-1 h-2" />
          </div>
        </CardContent>
      </Card>

      {!questions.length && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex items-start space-x-3 pt-6">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <div>
              <h4 className="font-semibold text-amber-700 dark:text-amber-500">No quiz questions returned</h4>
              <p className="text-sm text-amber-600/80 dark:text-amber-500/80 mt-1">
                Not enough indexed course material may be available to generate this quiz.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showSuccess ? (
        <Card className="flex flex-col items-center justify-center p-12 min-h-[400px] border-primary/20 bg-primary/5">
          <div className="w-72 h-72">
            {lottieData ? (
              <Lottie animationData={lottieData} loop={false} />
            ) : (
              <CheckCircle2 className="w-32 h-32 text-primary animate-bounce mx-auto" />
            )}
          </div>
          <h3 className="text-2xl font-bold mt-6 text-primary animate-pulse">Submitting your quiz...</h3>
          <p className="text-muted-foreground mt-2">Great job completing the practice!</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {questions.map((question, index) => {
            const qName = getQuestionName(question, index);
            const choices = getQuestionChoices(question);
            
            return (
              <Card key={getQuestionId(question, index)} className="transition-all hover:shadow-lg border-l-4 border-l-transparent hover:border-l-primary duration-300">
                <CardHeader>
                  <CardTitle className="text-lg leading-relaxed font-semibold">
                    <span className="text-primary/70 mr-3 text-xl">{index + 1}.</span>
                    {getQuestionText(question, index)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup 
                    value={answers[qName]} 
                    onValueChange={(val) => handleAnswerChange(qName, val)}
                    className="space-y-3 mt-2"
                  >
                    {choices.map((choice) => (
                      <div key={choice.value} className="relative flex items-center space-x-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-all cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary/50 has-[:checked]:shadow-sm group">
                        <RadioGroupItem value={choice.value} id={`${qName}-${choice.value}`} className="w-5 h-5 text-primary border-primary/50" />
                        <Label htmlFor={`${qName}-${choice.value}`} className="flex-1 cursor-pointer font-medium text-base leading-snug group-hover:text-primary transition-colors">
                          {choice.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            );
          })}

          {questions.length > 0 && (
            <div className="flex justify-end pt-8 pb-12 sticky bottom-4 z-10">
              <Button 
                size="lg" 
                onClick={handleSubmit} 
                disabled={!canSubmit || submitting}
                className="w-full sm:w-auto px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
              >
                {submitting ? "Submitting..." : "Submit Quiz"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
