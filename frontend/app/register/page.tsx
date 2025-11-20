"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import api from "@/lib/api";

declare global {
  interface Window {
    google?: any;
  }
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [motherTongue, setMotherTongue] = useState("English");
  const [documentationLanguage, setDocumentationLanguage] = useState("English");
  const [languages, setLanguages] = useState<string[]>(["English", "Deutsch (German)", "Français (French)"]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, googleLogin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api
      .listLanguages()
      .then((list) => setLanguages(list))
      .catch(() => {
        // keep defaults if the lookup fails
      });
  }, []);

  const handleGoogleSuccess = useCallback(async (credential: string) => {
    setError("");
    setLoading(true);

    try {
      await googleLogin(credential, motherTongue, motherTongue, documentationLanguage);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-up failed");
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await register(
        email,
        password,
        fullName,
        motherTongue,
        motherTongue,
        documentationLanguage,
      );
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
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

          {/* Register Form */}
          <Card>
            <h1 className="text-2xl font-bold text-center mb-6">
              Create Your Account
            </h1>

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
                type="text"
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="John Doe"
              />

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
                placeholder="At least 8 characters"
                required
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-200">
                  <span className="block mb-2">Mother tongue (UI language)</span>
                  <select
                    value={motherTongue}
                    onChange={(e) => setMotherTongue(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                    aria-label="Select mother tongue"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-200">
                  <span className="block mb-2">Language for generated documents</span>
                  <select
                    value={documentationLanguage}
                    onChange={(e) => setDocumentationLanguage(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                    aria-label="Select documentation language"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-indigo-400 hover:text-indigo-300"
              >
                Log in
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
