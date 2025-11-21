"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import api, { User } from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (
    credential: string,
    preferredLanguage?: string,
    motherTongue?: string,
    documentationLanguage?: string,
  ) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string,
    preferredLanguage?: string,
    motherTongue?: string,
    documentationLanguage?: string,
  ) => Promise<void>;
  logout: () => void;
  updateUser: (
    fullName?: string,
    preferredLanguage?: string,
    motherTongue?: string,
    documentationLanguage?: string,
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
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
    // Ensure token is set before setting user
    await new Promise(resolve => setTimeout(resolve, 50));
    setUser(response.user);
  };

  const googleLogin = async (
    credential: string,
    preferredLanguage = "en",
    motherTongue = "en",
    documentationLanguage = "en",
  ) => {
    const response = await api.googleLogin(
      credential,
      preferredLanguage,
      motherTongue,
      documentationLanguage,
    );
    setUser(response.user);
  };

  const register = async (
    email: string,
    password: string,
    fullName?: string,
    preferredLanguage = "en",
    motherTongue = "en",
    documentationLanguage = "en",
  ) => {
    const response = await api.register(
      email,
      password,
      fullName,
      preferredLanguage,
      motherTongue,
      documentationLanguage,
    );
    // Ensure token is set before setting user
    await new Promise(resolve => setTimeout(resolve, 50));
    setUser(response.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const updateUser = async (
    fullName?: string,
    preferredLanguage?: string,
    motherTongue?: string,
    documentationLanguage?: string,
  ) => {
    const updatedUser = await api.updateUser(
      fullName,
      preferredLanguage,
      motherTongue,
      documentationLanguage,
    );
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    const me = await api.getCurrentUser();
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, googleLogin, register, logout, updateUser, refreshUser }}
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
