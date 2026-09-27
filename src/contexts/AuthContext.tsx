import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  /** Null until the session is fully authenticated (see mfaRequired). */
  session: Session | null;
  /** Null until the session is fully authenticated (see mfaRequired). */
  user: User | null;
  /** True until both the session and its assurance level are known. */
  loading: boolean;
  /**
   * The person has signed in with their password (or Google, or a recovery
   * link) but has two-factor authentication and has not entered a code yet.
   * They have no more access than a visitor until they do.
   */
  mfaRequired: boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  mfaRequired: false,
  signOut: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

interface AuthState {
  /** The stored session, whatever its assurance level. Never exposed raw. */
  session: Session | null;
  mfaRequired: boolean;
  loading: boolean;
}

const SIGNED_OUT: AuthState = { session: null, mfaRequired: false, loading: false };

/**
 * If the assurance level cannot be read, fail closed: anyone with a verified
 * factor is treated as still needing it. Signing in again sorts it out; letting
 * an aal1 session through would not.
 */
const hasVerifiedFactor = (session: Session) =>
  (session.user.factors ?? []).some((f) => f.status === "verified");

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    mfaRequired: false,
    loading: true,
  });
  // Every auth event starts a new evaluation; only the latest may land, so a
  // slow answer about an old session can never overwrite a newer one.
  const evaluation = useRef(0);

  const evaluate = useCallback((session: Session | null) => {
    const id = ++evaluation.current;
    if (!session) {
      setState(SIGNED_OUT);
      return;
    }
    // Same person (token refresh, profile update, a verified 2FA code): keep
    // what is on screen until the new level is known, so pages do not flash a
    // spinner every hour. Someone new: show nobody until we know their level.
    setState((prev) =>
      prev.session?.user.id === session.user.id
        ? prev
        : { session: null, mfaRequired: false, loading: true },
    );
    // getAuthenticatorAssuranceLevel() reads the session through the auth
    // lock, which the SDK is still holding while it runs onAuthStateChange
    // callbacks. Awaiting it inside the callback can deadlock; defer it.
    setTimeout(async () => {
      let mfaRequired = hasVerifiedFactor(session);
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!error && data) {
          mfaRequired = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
        }
      } catch {
        // Keep the fail-closed default above.
      }
      if (id !== evaluation.current) return;
      setState({ session, mfaRequired, loading: false });
    }, 0);
  }, []);

  useEffect(() => {
    // The counter object itself (not a number read from it) is what the
    // cleanup bumps, so evaluations still in flight at unmount are dropped.
    const evaluations = evaluation;
    let heardEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      heardEvent = true;
      evaluate(session);
    });

    // INITIAL_SESSION normally arrives through the listener. This covers
    // clients (and test doubles) that never emit it, without letting a late
    // getSession() answer override an event that already came in.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!heardEvent) evaluate(session);
    });

    return () => {
      evaluations.current++;
      subscription.unsubscribe();
    };
  }, [evaluate]);

  const signOut = useCallback(async (): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signOut();
    if (!error) return { error: null };

    // The SDK keeps the session on this device when the server cannot be
    // reached. On a shared computer that leaves the next person signed in as
    // this one, so forget it locally and say plainly what did not happen.
    try {
      const storageKey = (supabase.auth as unknown as { storageKey: string }).storageKey;
      for (const suffix of ["", "-code-verifier", "-user"]) {
        localStorage.removeItem(`${storageKey}${suffix}`);
      }
    } catch {
      return {
        error: new Error("Could not sign you out. Check your connection and try again."),
      };
    }
    evaluation.current++;
    setState(SIGNED_OUT);
    return {
      error: new Error(
        "You are signed out on this device, but the server could not be reached, so your other devices may still be signed in.",
      ),
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const fullySignedIn = !state.loading && !state.mfaRequired && state.session !== null;
    const session = fullySignedIn ? state.session : null;
    return {
      session,
      user: session?.user ?? null,
      loading: state.loading,
      mfaRequired: !state.loading && state.mfaRequired,
      signOut,
    };
  }, [state, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
