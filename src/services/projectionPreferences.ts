import { supabase } from "../lib/supabase";
import {
  normalizeProjectionPreferences,
  type ProjectionPreferences,
  type ProjectionProfile,
} from "../app/transactions/projectionPreferences";

const PROJECTION_PREFERENCES_TABLE = "user_projection_preferences";

export async function fetchProjectionPreferencesRemote(params: {
  userId: string;
  profileId: ProjectionProfile;
}): Promise<ProjectionPreferences | null> {
  const userId = String(params.userId ?? "").trim();
  const profileId = String(params.profileId ?? "").trim().toLowerCase() as ProjectionProfile;

  if (!userId) return null;

  const { data, error } = await supabase
    .from(PROJECTION_PREFERENCES_TABLE)
    .select("preferences")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeProjectionPreferences((data as any).preferences);
}

export async function upsertProjectionPreferencesRemote(params: {
  userId: string;
  profileId: ProjectionProfile;
  preferences: ProjectionPreferences;
}): Promise<void> {
  const userId = String(params.userId ?? "").trim();
  const profileId = String(params.profileId ?? "").trim().toLowerCase() as ProjectionProfile;

  if (!userId) {
    throw new Error("Usuário inválido para salvar preferências da projeção.");
  }

  const preferences = normalizeProjectionPreferences(params.preferences);

  const { error } = await supabase
    .from(PROJECTION_PREFERENCES_TABLE)
    .upsert(
      {
        user_id: userId,
        profile_id: profileId,
        preferences,
      },
      {
        onConflict: "user_id,profile_id",
      }
    );

  if (error) throw error;
}
