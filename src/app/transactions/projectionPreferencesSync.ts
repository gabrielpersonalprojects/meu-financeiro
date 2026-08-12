import {
  EMPTY_PROJECTION_PREFERENCES,
  clearProjectionPreferences,
  normalizeProjectionPreferences,
  readProjectionPreferencesStorageEntry,
  type ProjectionPreferences,
  type ProjectionProfile,
} from "./projectionPreferences";

export type ProjectionPreferencesRemoteStore = {
  fetch: (params: {
    userId: string;
    profileId: ProjectionProfile;
  }) => Promise<ProjectionPreferences | null>;
  upsert: (params: {
    userId: string;
    profileId: ProjectionProfile;
    preferences: ProjectionPreferences;
  }) => Promise<void>;
};

export type ProjectionPreferencesLoadSource =
  | "remote"
  | "local_migrated"
  | "local_fallback"
  | "default";

export type ProjectionPreferencesLoadResult = {
  preferences: ProjectionPreferences;
  source: ProjectionPreferencesLoadSource;
  migrationError: Error | null;
};

export const REMOTE_PROJECTION_PREFERENCES_ERROR =
  "Não foi possível carregar a configuração da projeção agora.";

export const REMOTE_PROJECTION_PREFERENCES_SAVE_ERROR =
  "Não foi possível salvar a configuração da projeção. Tente novamente.";

const resolveStorage = (): Pick<Storage, "getItem" | "removeItem"> => {
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem: () => null,
    removeItem: () => undefined,
  };
};

export const resolveProjectionPreferencesRemoteFirst = async (params: {
  userId: string;
  profileId: ProjectionProfile;
  remoteStore: ProjectionPreferencesRemoteStore;
  storage?: Pick<Storage, "getItem" | "removeItem">;
  migrateLocalWhenRemoteMissing?: boolean;
}): Promise<ProjectionPreferencesLoadResult> => {
  const {
    userId,
    profileId,
    remoteStore,
    storage = resolveStorage(),
    migrateLocalWhenRemoteMissing = true,
  } = params;

  const cleanUserId = String(userId ?? "").trim();
  if (!cleanUserId) {
    return {
      preferences: { ...EMPTY_PROJECTION_PREFERENCES },
      source: "default",
      migrationError: null,
    };
  }

  const remote = await remoteStore.fetch({
    userId: cleanUserId,
    profileId,
  });

  if (remote) {
    return {
      preferences: normalizeProjectionPreferences(remote),
      source: "remote",
      migrationError: null,
    };
  }

  const localEntry = readProjectionPreferencesStorageEntry(
    cleanUserId,
    profileId,
    storage
  );

  if (
    !migrateLocalWhenRemoteMissing ||
    !localEntry.exists ||
    !localEntry.preferences
  ) {
    return {
      preferences: { ...EMPTY_PROJECTION_PREFERENCES },
      source: "default",
      migrationError: null,
    };
  }

  const localPreferences = normalizeProjectionPreferences(localEntry.preferences);

  try {
    await remoteStore.upsert({
      userId: cleanUserId,
      profileId,
      preferences: localPreferences,
    });
    clearProjectionPreferences(cleanUserId, profileId, storage);
    return {
      preferences: localPreferences,
      source: "local_migrated",
      migrationError: null,
    };
  } catch (error: any) {
    return {
      preferences: localPreferences,
      source: "local_fallback",
      migrationError:
        error instanceof Error ? error : new Error(String(error ?? "")),
    };
  }
};
