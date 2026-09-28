import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/Login";
import NotFound from "@/pages/not-found";

// Placeholder home until the Resonance screens land (build step 9).
function Home() {
  const { user, logout } = useAuth();
  return (
    <main style={{ maxWidth: 390, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: "2rem", margin: 0 }}>
        Resonance
      </h1>
      <p style={{ color: "#5A6168" }}>Signed in as {user?.email}. The screens are being built.</p>
      <button onClick={logout}>Sign out</button>
    </main>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AuthGate>
          <Switch>
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </AuthGate>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
