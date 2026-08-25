import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/*
  Auth + athlete-profile session state for RaceIQ.
  See docs/design-auth-and-profiles.md.

  When Supabase isn't configured (no env vars), this provider reports
  `ready: true` with a null user so the app can still render the signed-out
  landing / local prototype path instead of hanging on a spinner.
*/

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  // Load (or lazily create) the profile row for the signed-in user.
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Hydrate the current session on mount, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => setReady(true));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadProfile(next?.user?.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = {
    ready,
    isConfigured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    reloadProfile: () => loadProfile(session?.user?.id),

    signInWithPassword: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, displayName) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      }),
    signInWithOAuth: (provider) =>
      supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      }),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
    updateProfile: async (patch) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", session?.user?.id)
        .select()
        .single();
      if (!error) setProfile(data);
      return { data, error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
