import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EMPTY_PROJECTION_PREFERENCES,
  buildProjectionPreferencesStorageKey,
  normalizeProjectionPreferences,
} from "../src/app/transactions/projectionPreferences";
import { resolveProjectionPreferencesRemoteFirst } from "../src/app/transactions/projectionPreferencesSync";

const makeStorage = (initial: Record<string, string> = {}) => {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  };
};

const pref = (value: any) => normalizeProjectionPreferences(value);

test("preferência remota tem prioridade sobre localStorage", async () => {
  const localKey = buildProjectionPreferencesStorageKey("u1", "pf");
  const { storage, values } = makeStorage({
    [localKey]: JSON.stringify(pref({ excludedAccountIds: ["account-local"] })),
  });

  const result = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pf",
    storage,
    remoteStore: {
      fetch: async () => pref({ excludedAccountIds: ["account-remote"] }),
      upsert: async () => undefined,
    },
  });

  assert.equal(result.source, "remote");
  assert.deepEqual(result.preferences.excludedAccountIds, ["account-remote"]);
  assert.equal(values.has(localKey), true);
});

test("primeiro acesso sem remota nem local mantém padrão atual", async () => {
  const { storage } = makeStorage();
  const result = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pf",
    storage,
    remoteStore: {
      fetch: async () => null,
      upsert: async () => undefined,
    },
  });

  assert.equal(result.source, "default");
  assert.deepEqual(result.preferences, EMPTY_PROJECTION_PREFERENCES);
});

test("migração local ocorre uma única vez quando remoto está ausente", async () => {
  const localKey = buildProjectionPreferencesStorageKey("u1", "pf");
  const local = pref({ excludedCardIds: ["card-1"], excludedTransactionIds: ["tx-1"] });
  const { storage, values } = makeStorage({
    [localKey]: JSON.stringify(local),
  });

  const saved: any[] = [];
  const result = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pf",
    storage,
    remoteStore: {
      fetch: async () => null,
      upsert: async (params) => {
        saved.push(params);
      },
    },
  });

  assert.equal(result.source, "local_migrated");
  assert.deepEqual(result.preferences, local);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].preferences, local);
  assert.equal(values.has(localKey), false);
});

test("migração local não ocorre sem usuário autenticado", async () => {
  const localKey = buildProjectionPreferencesStorageKey("", "pf");
  const { storage, values } = makeStorage({
    [localKey]: JSON.stringify(pref({ excludedCardIds: ["card-1"] })),
  });

  const result = await resolveProjectionPreferencesRemoteFirst({
    userId: "",
    profileId: "pf",
    storage,
    remoteStore: {
      fetch: async () => {
        throw new Error("não deveria consultar remoto sem usuário");
      },
      upsert: async () => {
        throw new Error("não deveria migrar sem usuário");
      },
    },
  });

  assert.equal(result.source, "default");
  assert.equal(values.has(localKey), true);
});

test("falha no Supabase durante migração preserva estado local e não limpa chave", async () => {
  const localKey = buildProjectionPreferencesStorageKey("u1", "pf");
  const local = pref({ excludedGroupIds: ["recurrence:fixed-series"] });
  const { storage, values } = makeStorage({
    [localKey]: JSON.stringify(local),
  });

  const result = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pf",
    storage,
    remoteStore: {
      fetch: async () => null,
      upsert: async () => {
        throw new Error("db down");
      },
    },
  });

  assert.equal(result.source, "local_fallback");
  assert.deepEqual(result.preferences, local);
  assert.equal(values.has(localKey), true);
  assert.ok(result.migrationError);
});

test("PF e PJ são isolados e usuários diferentes não compartilham preferência", async () => {
  const db = new Map<string, any>();
  const key = (userId: string, profileId: string) => `${userId}:${profileId}`;

  const remoteStore = {
    fetch: async ({ userId, profileId }: any) => db.get(key(userId, profileId)) ?? null,
    upsert: async ({ userId, profileId, preferences }: any) => {
      db.set(key(userId, profileId), preferences);
    },
  };

  await remoteStore.upsert({
    userId: "u1",
    profileId: "pf",
    preferences: pref({ excludedAccountIds: ["acc-pf"] }),
  });
  await remoteStore.upsert({
    userId: "u1",
    profileId: "pj",
    preferences: pref({ excludedCardIds: ["card-pj"] }),
  });
  await remoteStore.upsert({
    userId: "u2",
    profileId: "pf",
    preferences: pref({ excludedTransactionIds: ["tx-u2"] }),
  });

  const u1pf = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pf",
    remoteStore,
  });
  const u1pj = await resolveProjectionPreferencesRemoteFirst({
    userId: "u1",
    profileId: "pj",
    remoteStore,
  });
  const u2pf = await resolveProjectionPreferencesRemoteFirst({
    userId: "u2",
    profileId: "pf",
    remoteStore,
  });

  assert.deepEqual(u1pf.preferences.excludedAccountIds, ["acc-pf"]);
  assert.deepEqual(u1pf.preferences.excludedCardIds, []);
  assert.deepEqual(u1pj.preferences.excludedCardIds, ["card-pj"]);
  assert.deepEqual(u1pj.preferences.excludedAccountIds, []);
  assert.deepEqual(u2pf.preferences.excludedTransactionIds, ["tx-u2"]);
  assert.deepEqual(u2pf.preferences.excludedAccountIds, []);
});

test("salvamento em App aguarda Supabase antes de atualizar estado local", () => {
  const app = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
  assert.match(app, /await upsertProjectionPreferencesRemote\(/);
  assert.match(app, /setProjectionPreferencesByProfile\(\(current\) => \(\{ \.\.\.current, \[profile\]: sanitized \}\)\)/);
});

test("modal permanece aberto em falha e mostra erro em Apply", () => {
  const modal = readFileSync(
    path.join(process.cwd(), "src", "components", "projection", "ProjectionConfigModal.tsx"),
    "utf8"
  );
  assert.match(modal, /setApplyError\(/);
  assert.match(modal, /await onApply\(draft\)/);
  assert.match(modal, /\{isApplying \? "Salvando\.\.\." : "Aplicar"\}/);
});

test("reabertura do modal recarrega preferência remota por perfil", () => {
  const tab = readFileSync(
    path.join(process.cwd(), "src", "components", "tabs", "ProjecaoTab.tsx"),
    "utf8"
  );
  assert.match(tab, /await onReloadPreferences\(profile, \{ migrateLocalWhenRemoteMissing: true \}\)/);
  assert.match(tab, /onRetryLoad=\{\(\) => \{ void requestReloadConfig\(\); \}\}/);
});

test("troca rápida PF/PJ ignora respostas atrasadas no carregamento", () => {
  const app = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
  const tab = readFileSync(
    path.join(process.cwd(), "src", "components", "tabs", "ProjecaoTab.tsx"),
    "utf8"
  );
  assert.match(app, /projectionPreferencesLoadRequestRef/);
  assert.match(app, /projectionPreferencesLoadRequestRef\.current\[profile\] !== requestId/);
  assert.match(tab, /configLoadRequestRef/);
  assert.match(tab, /configLoadRequestRef\.current !== requestId/);
});

test("filtros visuais Origem e Movimentação não fazem parte das preferências persistidas", () => {
  const prefs = pref({
    excludedAccountIds: ["a1"],
    excludedCardIds: ["c1"],
    excludedTransactionIds: ["t1"],
    excludedGroupIds: ["g1"],
    movement: "entradas",
    origin: "cartoes",
    search: "abc",
  } as any);

  assert.deepEqual(Object.keys(prefs).sort(), [
    "excludedAccountIds",
    "excludedCardIds",
    "excludedGroupIds",
    "excludedTransactionIds",
    "version",
  ]);
});
