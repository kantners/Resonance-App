import { Route, Router, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/Login";
import NotFound from "@/pages/not-found";
import BriefScreen from "@/screens/Brief";
import RecoveryRuleScreen from "@/screens/RecoveryRule";
import LogScreen from "@/screens/Log";
import MorningCheckScreen from "@/screens/MorningCheck";
import SleepScreen from "@/screens/Sleep";
import ExposureManualScreen from "@/screens/ExposureManual";
import StudyScreen from "@/screens/Study";
import SettingsScreen from "@/screens/Settings";
import { PrivacyScreen, TermsScreen } from "@/screens/Legal";
import { PendingSubScreen, PendingTabScreen } from "@/screens/Pending";

function Screens() {
  return (
    <Switch>
      <Route path="/" component={BriefScreen} />
      <Route path="/how" component={RecoveryRuleScreen} />
      <Route path="/log" component={LogScreen} />
      <Route path="/log/morning" component={MorningCheckScreen} />
      <Route path="/log/sleep" component={SleepScreen} />
      <Route path="/log/exposure" component={ExposureManualScreen} />
      <Route path="/study" component={StudyScreen} />
      <Route path="/settings" component={SettingsScreen} />
      {/* Scheduled after October 4 (step 9b) */}
      <Route path="/log/exposure/screenshot">{() => <PendingSubScreen title="Screenshot import" back={{ href: "/log/exposure", label: "Manual entry" }} />}</Route>
      <Route path="/log/stillness">{() => <PendingSubScreen title="Log stillness" />}</Route>
      <Route path="/log/reading">{() => <PendingSubScreen title="Reading" />}</Route>
      <Route path="/log/fasting">{() => <PendingSubScreen title="Fasting" />}</Route>
      <Route path="/quiet/:date">{() => <PendingSubScreen title="The missing quiet" back={{ href: "/", label: "Brief" }} />}</Route>
      <Route path="/study/session">{() => <PendingSubScreen title="Session record" back={{ href: "/study", label: "Study" }} />}</Route>
      <Route path="/trends">{() => <PendingTabScreen title="Trends" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  // Privacy and Terms are readable without an account.
  if (location === "/privacy") return <PrivacyScreen />;
  if (location === "/terms") return <TermsScreen />;
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginPage />;
  return <Screens />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AuthGate />
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
