import type { Metadata } from "next";
import TravelQuiz from "./TravelQuiz";

export const metadata: Metadata = {
  title: "کوییز سفر",
  description:
    "با چند سؤال کوتاه، سبک سفر خود را بشناسید و مقصد پیشنهادی متناسب با سلیقه و بودجه‌تان را در سفرینو پیدا کنید.",
};

export default function QuizPage() {
  return <TravelQuiz />;
}
