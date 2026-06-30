/**
 * Auth hooks — encapsulate direct database auth calls.
 *
 * Components should use these hooks instead of calling db.auth.* directly.
 */

import { useCallback } from "react";
import { useDatabaseService } from "@/contexts/DatabaseContext";

/** Hook for sign-out action */
export function useSignOut() {
  const db = useDatabaseService();

  const signOut = useCallback(async () => {
    return db.auth.signOut();
  }, [db]);

  return { signOut };
}

/** Hook for sign-in action */
export function useSignIn() {
  const db = useDatabaseService();

  const signIn = useCallback(
    async (email: string, password: string) => {
      return db.auth.signInWithPassword(email, password);
    },
    [db],
  );

  const onAuthStateChange = useCallback(
    (callback: (event: string) => void) => {
      return db.auth.onAuthStateChange((event) => callback(event));
    },
    [db],
  );

  return { signIn, onAuthStateChange };
}

/** Hook for sign-up action */
export function useSignUp() {
  const db = useDatabaseService();

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { display_name?: string },
    ) => {
      return db.auth.signUp(email, password, metadata);
    },
    [db],
  );

  return { signUp };
}

/** Hook for password change */
export function useChangePassword() {
  const db = useDatabaseService();

  const changePassword = useCallback(
    async (newPassword: string) => {
      return db.auth.updatePassword(newPassword);
    },
    [db],
  );

  return { changePassword };
}

/** Hook for requesting a password-reset email */
export function useResetPassword() {
  const db = useDatabaseService();

  const resetPassword = useCallback(
    async (email: string, redirectTo: string) => {
      return db.auth.resetPasswordForEmail(email, redirectTo);
    },
    [db],
  );

  return { resetPassword };
}

/** Hook for invite code validation and competition lookup */
export function useInviteCodes() {
  const db = useDatabaseService();

  const checkInviteCode = useCallback(
    async (code: string) => {
      return db.inviteCodes.checkInviteCode(code);
    },
    [db],
  );

  return { checkInviteCode };
}

/** Hook for competition lookup */
export function useCompetitionLookup() {
  const db = useDatabaseService();

  const getCompetitionById = useCallback(
    async (competitionId: string) => {
      return db.competitions.getById(competitionId);
    },
    [db],
  );

  return { getCompetitionById };
}

/** Hook for admin user management */
export function useUserManagement() {
  const db = useDatabaseService();

  const getAllProfiles = useCallback(
    async (competitionId: string) => {
      return db.profiles.getAllProfiles(competitionId);
    },
    [db],
  );

  const makeAdmin = useCallback(
    async (userId: string) => {
      return db.profiles.updateProfile(userId, { is_admin: true });
    },
    [db],
  );

  return { getAllProfiles, makeAdmin };
}
