"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import api from "./api";

interface User {
  id: number;
  email: string;
  full_name?: string;
  preferred_language: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string, preferredLanguage?: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string, preferredLanguage?: string) => Promise<void>;
  logout: () => void;
  updateUser: (fullName?: string, preferredLanguage?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = api.getToken();
    if (token) {
      api
        .getCurrentUser()
        .then((userData) => setUser(userData))
        .catch(() => {
          api.logout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
  };

  const googleLogin = async (credential: string, preferredLanguage = "en") => {
    const response = await api.googleLogin(credential, preferredLanguage);
    setUser(response.user);
  };

  const register = async (
    email: string,
    password: string,
    fullName?: string,
    preferredLanguage = "en"
  ) => {
    const response = await api.register(email, password, fullName, preferredLanguage);
    setUser(response.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const updateUser = async (fullName?: string, preferredLanguage?: string) => {
    const updatedUser = await api.updateUser(fullName, preferredLanguage);
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, googleLogin, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
