import { createFileRoute } from "@tanstack/react-router";
import { FidgetApp } from "@/components/fidget/FidgetApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FidgetApp />;
}
