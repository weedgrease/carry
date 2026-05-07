import { Toaster } from "@/components/ui/sonner";
import { Router } from "./router";

/** Root application: routed pages plus the global toast surface. */
export default function App() {
  return (
    <>
      <Router />
      <Toaster richColors closeButton />
    </>
  );
}
