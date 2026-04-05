import type { Metadata } from "next";
import CircleSumChallenge from "@/components/circle-sum-challenge/CircleSumChallenge";

export const metadata: Metadata = {
  title: "Circle Sum Challenge",
  description:
    "A polished neon math challenge where you mentally sum an orbit of numbers before the timer expires.",
};

export default function Home() {
  return <CircleSumChallenge />;
}
