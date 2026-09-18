import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidBrazilWhatsapp,
  normalizeWhatsappForStorage,
} from "../src/utils/whatsapp";

const whatsappUser = require("../api/_lib/whatsappUser");

test("normalização Nimble aplica exatamente a regra de DDD e nono dígito", () => {
  const examples = [
    ["(11) 8765-4321", "5511987654321"],
    ["(11) 98765-4321", "5511987654321"],
    ["(41) 99876-5432", "554198765432"],
    ["(41) 8765-4321", "554187654321"],
    ["+55 (41) 99876-5432", "554198765432"],
  ];

  for (const [input, expected] of examples) {
    assert.equal(normalizeWhatsappForStorage(input), expected);
    assert.equal(whatsappUser.normalizeWhatsappPhone(input), expected);
    assert.equal(isValidBrazilWhatsapp(input), true);
  }
});

test("normalização rejeita números incompatíveis com a regra da Nimble", () => {
  assert.equal(normalizeWhatsappForStorage("(41) 88765-4321"), "");
  assert.equal(isValidBrazilWhatsapp("(41) 88765-4321"), false);
});

test("variantes mantêm compatibilidade com número legado de DDD sem nono dígito", () => {
  const variants = whatsappUser.toEquivalentDigits("554187654321");
  assert.equal(variants.includes("5541987654321"), true);
  assert.equal(variants.includes("418765432"), false);
  assert.equal(variants.includes("4187654321"), true);
});

test("webhook envia somente whatsapp normalizado e primeiro nome com idempotência", async () => {
  const adminPath = require.resolve("../api/_lib/supabaseAdmin");
  const endpointPath = require.resolve("../api/nimble/user-registration");
  const originalAdmin = require(adminPath);
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL;
  const updates: any[] = [];
  const deliveries: any[] = [];

  const supabase = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "gabriel@example.com",
            user_metadata: { display_name: "Gabriel Fagundes" },
          },
        },
        error: null,
      }),
    },
    rpc: async (name: string, args: any) => {
      assert.equal(name, "claim_nimble_welcome_delivery");
      assert.equal(args.p_whatsapp, "554198765432");
      return { data: true, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              whatsapp_number: "5541998765432",
              whatsapp_number_normalized: "5541998765432",
            },
            error: null,
          }),
        }),
      }),
      update: (payload: any) => {
        updates.push(payload);
        return {
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    }),
  };

  try {
    require.cache[adminPath]!.exports = { getSupabaseAdmin: () => supabase };
    delete require.cache[endpointPath];
    process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL = "https://example.test/hook";
    globalThis.fetch = (async (_url: any, init: any) => {
      deliveries.push(init);
      return new Response("ok", { status: 200 });
    }) as any;

    const handler = require(endpointPath);
    const req = {
      method: "POST",
      headers: { authorization: "Bearer valid-user-session" },
    };
    const response: any = { statusCode: 0, body: null };
    const res = {
      status(code: number) {
        response.statusCode = code;
        return this;
      },
      json(body: any) {
        response.body = body;
        return this;
      },
      setHeader() {},
    };

    await handler(req, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "sent");
    assert.equal(deliveries.length, 1);
    assert.deepEqual(JSON.parse(deliveries[0].body), {
      whatsapp: "554198765432",
      first_name: "Gabriel",
    });
    assert.match(deliveries[0].headers["X-Idempotency-Key"], /^fluxmoney-user-whatsapp-linked-/);
    assert.equal(updates[updates.length - 1].nimble_welcome_status, "sent");
  } finally {
    require.cache[adminPath]!.exports = originalAdmin;
    delete require.cache[endpointPath];
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL;
    } else {
      process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL = originalUrl;
    }
  }
});

test("webhook não duplica quando o banco informa envio anterior ou em andamento", async () => {
  const adminPath = require.resolve("../api/_lib/supabaseAdmin");
  const endpointPath = require.resolve("../api/nimble/user-registration");
  const originalAdmin = require(adminPath);
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL;
  let deliveryCount = 0;

  const supabase = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "gabriel@example.com",
            user_metadata: { display_name: "Gabriel Fagundes" },
          },
        },
        error: null,
      }),
    },
    rpc: async () => ({ data: false, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              whatsapp_number: "554187654321",
              whatsapp_number_normalized: "554187654321",
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  try {
    require.cache[adminPath]!.exports = { getSupabaseAdmin: () => supabase };
    delete require.cache[endpointPath];
    process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL = "https://example.test/hook";
    globalThis.fetch = (async () => {
      deliveryCount += 1;
      return new Response("ok", { status: 200 });
    }) as any;

    const handler = require(endpointPath);
    const response: any = { statusCode: 0, body: null };
    const res = {
      status(code: number) {
        response.statusCode = code;
        return this;
      },
      json(body: any) {
        response.body = body;
        return this;
      },
      setHeader() {},
    };

    await handler(
      { method: "POST", headers: { authorization: "Bearer valid-user-session" } },
      res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "already_sent_or_in_progress");
    assert.equal(deliveryCount, 0);
  } finally {
    require.cache[adminPath]!.exports = originalAdmin;
    delete require.cache[endpointPath];
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL;
    } else {
      process.env.NIMBLE_USER_REGISTRATION_WEBHOOK_URL = originalUrl;
    }
  }
});
