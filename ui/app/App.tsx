import { Toaster } from "@/components/ui/sonner";
import { Router } from "./router";

export default function App() {
  return (
    <>
      <Router />
      <Toaster richColors closeButton />
    </>
  );
}
