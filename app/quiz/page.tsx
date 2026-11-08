'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TravelQuiz from './TravelQuiz';
import type { QuizCompletion, QuizProgress } from './TravelQuiz';
import { useTravel } from '../context/TravelContext';

const DESTINATION_NAMES: Record<string, string> = {
  kish: 'کیش',
  istanbul: 'استانبول',
  dubai: 'دبی',
  cappadocia: 'کاپادوکیه',
  nature: 'شمال ایران',
};

const BUDGET_VALUES: Record<string, number> = {
  economy: 15,
  balanced: 30,
  comfort: 50,
  premium: 60,
};

const DAY_VALUES: Record<string, number> = {
  short: 3,
  medium: 5,
  long: 7,
  flexible: 3,
};

const STYLE_VALUES: Record<string, string> = {
  nature: 'nature',
  history: 'history',
  luxury: 'modern',
  adventure: 'nature',
};

export default function QuizPage() {
  const router = useRouter();
  const { travelData, setTravelData } = useTravel();

  const handleProgress = useCallback(
    (progress: QuizProgress) => {
      setTravelData((current) => ({
        ...current,
        quizAnswers: progress.answers,
        quizStep: progress.step,
      }));
    },
    [setTravelData],
  );

  const handleComplete = useCallback(
    ({ result, answers }: QuizCompletion) => {
      const origin = travelData.origin || 'تهران';
      const destination = DESTINATION_NAMES[result] || travelData.destination || 'کیش';
      const budget = BUDGET_VALUES[answers.budget] || travelData.budget || 15;
      const days = DAY_VALUES[answers.duration] || travelData.days || 3;
      const tripStyle = STYLE_VALUES[answers.style] || travelData.tripStyle || 'nature';

      setTravelData({
        ...travelData,
        origin,
        destination,
        budget,
        days,
        tripStyle,
        quizResult: result,
        quizAnswers: answers,
        quizStep: 5,
      });
      router.push('/transport');
    },
    [router, setTravelData, travelData],
  );

  return (
    <TravelQuiz
      initialAnswers={travelData.quizAnswers}
      initialStep={travelData.quizStep}
      onProgress={handleProgress}
      onComplete={handleComplete}
    />
  );
}
