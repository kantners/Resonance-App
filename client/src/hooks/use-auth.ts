import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AuthUser {
  id: number;
  email: string;
  firstName: string | null;
  onboardingComplete: boolean;
}

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/me"],
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        const res = await apiRequest("GET", "/api/me");
        return res as unknown as AuthUser;
      } catch (e: any) {
        if (e.message?.includes("401") || e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["/api/me"], null);
      qc.clear();
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
  };
}
