import { createFileRoute } from "@tanstack/react-router";
import ShatterpointGame from "@/components/game/ShatterpointGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIZZ: Shatterpoint — Glass Bridge Arena" },
      {
        name: "description",
        content:
          "Cross a suspended glass bridge above the void in FIZZ: Shatterpoint, a cinematic glass-bridge game from Fizz Casino.",
      },
      { name: "theme-color", content: "#05060a" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return <ShatterpointGame />;
}