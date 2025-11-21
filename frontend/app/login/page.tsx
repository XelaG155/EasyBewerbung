"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, googleLogin } = useAuth();
  const router = useRouter();

  const handleGoogleSuccess = useCallback(async (credential: string) => {
    setError("");
    setLoading(true);

    try {
      await googleLogin(credential);
      // Small delay to ensure token is set
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [googleLogin, router]);

  const handleGoogleError = useCallback((err: any) => {
    console.error("Google Auth Error:", err);
    setError("Google initialization failed");
  }, []);

  const { setGoogleLoaded, googleClientId } = useGoogleAuth(handleGoogleSuccess, handleGoogleError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      // Explicit delay to ensure token is saved to localStorage
      await new Promise(resolve => setTimeout(resolve, 200));
      // Force full page reload to ensure token is properly loaded
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={() => setGoogleLoaded(true)}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                EB
              </div>
              <span className="text-2xl font-bold">EasyBewerbung</span>
            </Link>
          </div>

          {/* Login Form */}
          <Card>
            <h1 className="text-2xl font-bold text-center mb-6">Welcome Back</h1>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Google Sign-In Button */}
            {googleClientId && (
              <div className="mb-6">
                <div id="googleSignInButton" className="flex justify-center"></div>
              </div>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="your@email.com"
                required
              />

              <Input
                type="password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Log In"}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="text-indigo-400 hover:text-indigo-300"
              >
                Sign up
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
