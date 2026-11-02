"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Warehouse, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [error, setError] = useState("");
  const isDevBypass = process.env.NEXT_PUBLIC_DEV_BYPASS === "true";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const msg =
        authError.message.includes("Invalid login")
          ? "Invalid email or password. Please try again."
          : authError.message.includes("Email not confirmed")
          ? "Please confirm your email before signing in."
          : authError.message;
      setError(msg);
      toast.error("Sign in failed", { description: msg });
      setLoading(false);
      return;
    }

    toast.success("Welcome back!", { description: "Redirecting to dashboard..." });
    router.push("/");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      toast.error("Google sign in failed", { description: authError.message });
      setGoogleLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setBypassLoading(true);
    try {
      const res = await fetch("/api/dev-bypass", { method: "POST" });
      if (res.ok) {
        toast.success("Dev bypass active!", { description: "Redirecting to dashboard..." });
        router.push("/");
        router.refresh();
      } else {
        toast.error("Bypass failed");
        setBypassLoading(false);
      }
    } catch {
      toast.error("Bypass failed — is the dev server running?");
      setBypassLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
            <Warehouse size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mini-AgniSuite</h1>
          <p className="text-sm text-muted mt-1">Warehouse & Dispatch System</p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Sign in</h2>
          <p className="text-sm text-muted mb-6">Enter your credentials to continue</p>

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-background hover:bg-card-hover text-sm font-medium text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {googleLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger flex items-start gap-2">
                <span className="mt-0.5 shrink-0">&#9888;</span>
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              required
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                autoComplete="current-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-muted hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          {/* Dev Bypass — only visible when NEXT_PUBLIC_DEV_BYPASS=true */}
          {isDevBypass && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-warning/30" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-warning font-medium">dev only</span>
                </div>
              </div>
              <button
                onClick={handleDevBypass}
                disabled={bypassLoading}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-warning/30 bg-warning/10 hover:bg-warning/20 text-sm font-medium text-warning transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bypassLoading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>&#9889;</span>
                )}
                Bypass Login (Dev)
              </button>
            </>
          )}
        </div>

        {/* Register Link */}
        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-primary hover:underline font-medium">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
