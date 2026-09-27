/**
 * client/src/components/StravaSyncButton.tsx
 * Shared Strava sync button — import and drop anywhere in the app.
 * Renders nothing automatically when Strava is not connected.
 *
 * Usage:
 *   import { StravaSyncButton } from "@/components/StravaSyncButton";
 *   <StravaSyncButton />
 */


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STRAVA_ORANGE = "#FC4C02";

export function StravaSyncButton() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Check connection status — re-validates every 10 minutes, silent on error
  const { data: status } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/strava/status"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const syncMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/strava/sync-oauth"),
    onSuccess: (data: any) => {
      toast({
        title: "Strava synced",
        description: data?.message ?? "Activities updated.",
      });
      // Refresh all pages that display activity data
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/weekly"] });
    },
    onError: (e: any) =>
      toast({
        title: "Sync failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  // Invisible when Strava isn't connected — no clutter for unconnected users
  if (!status?.connected) return null;

  return (
    <button
      type="button"
      onClick={() => syncMut.mutate()}
      disabled={syncMut.isPending}
      title="Sync latest Strava activities"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        borderRadius: 99,
        border: `1.5px solid ${syncMut.isPending ? "rgba(0,0,0,0.08)" : STRAVA_ORANGE}`,
        background: syncMut.isPending ? "transparent" : `${STRAVA_ORANGE}12`,
        color: syncMut.isPending ? "#94a3b8" : STRAVA_ORANGE,
        fontSize: 11,
        fontWeight: 700,
        cursor: syncMut.isPending ? "not-allowed" : "pointer",
        transition: "all 160ms",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap" as const,
        fontFamily: "inherit",
      }}
    >
      <RefreshCw size={10} />
      {syncMut.isPending ? "Syncing…" : "Sync Strava"}
    </button>
  );
}
