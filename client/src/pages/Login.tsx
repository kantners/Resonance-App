import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [, navigate] = useHashLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register" && firstName) body.firstName = firstName;
      return apiRequest("POST", endpoint, body);
    },
    onSuccess: async (data: any) => {
      // Set user data directly — no invalidate, avoids loading flicker
      const user = data?.user ?? data;
      qc.setQueryData(["/api/me"], user);
    },
    onError: (e: any) => {
      toast({ title: mode === "login" ? "Login failed" : "Registration failed", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    mutation.mutate();
  };

  return (
    <div style={{
      minHeight: "100svh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg, #faf9f6)",
      padding: "1.5rem",
    }}>
      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{
          fontSize: "2.25rem",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontStyle: "italic",
          transform: "skewX(-13deg)",
          display: "inline-block",
          color: "var(--color-primary, #065f46)",
          marginBottom: "0.25rem",
        }}>
          KEWT
        </div>
        <div style={{
          fontSize: "0.8125rem",
          color: "var(--color-muted, #6b7280)",
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          by Blue Ember Wellness
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-ember, #f59e0b)", marginTop: "0.5rem", fontStyle: "italic" }}>
          Breathe. Reset. Return.
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "white",
        borderRadius: "1rem",
        padding: "2rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", marginBottom: "1.75rem", background: "#f3f4f6", borderRadius: "0.5rem", padding: "0.25rem" }}>
          {(["login", "register"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                transition: "all 0.15s",
                background: mode === m ? "white" : "transparent",
                color: mode === m ? "var(--color-primary, #065f46)" : "#6b7280",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: "0.375rem" }}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="off"
                style={{ width: "100%", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e5e7eb", fontSize: "1rem", background: "#fafafa", color: "#111827", boxSizing: "border-box" }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: "0.375rem" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="off"
              style={{ width: "100%", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e5e7eb", fontSize: "1rem", background: "#fafafa", color: "#111827", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: "0.375rem" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="off"
              style={{ width: "100%", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e5e7eb", fontSize: "1rem", background: "#fafafa", color: "#111827", boxSizing: "border-box" }}
            />
            {mode === "register" && (
              <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "var(--color-text-faint)" }}>Minimum 8 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || !email || !password}
            style={{
              marginTop: "0.5rem",
              width: "100%",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "var(--color-primary, #065f46)",
              color: "white",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
              opacity: (mutation.isPending || !email || !password) ? 0.65 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {mutation.isPending ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {mode === "login" && (
          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.8125rem", color: "var(--color-text-faint)" }}>
            New to <span style={{ fontStyle: "italic", fontWeight: 700, color: "var(--color-primary, #065f46)" }}>KEWT</span>?{" "}
            <button onClick={() => setMode("register")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-primary, #065f46)", fontWeight: 600, fontSize: "0.8125rem" }}>
              Create an account
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
