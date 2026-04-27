// @ts-nocheck
import { validateEnv } from "../index.js";

const FULL_VALID_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@host/db",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "a-very-long-service-role-key-value",
  OPENROUTER_API_KEY: "sk-or-test-key-value",
  ENABLE_CENTRAL_SCORING: "true",
};

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("validateEnv", () => {
  // Prevent process.exit in tests
  let exitSpy: jest.SpyInstance;
  beforeEach(() => {
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });
  afterEach(() => exitSpy.mockRestore());

  it("passes with all critical vars set", () => {
    withEnv(FULL_VALID_ENV, () => {
      const result = validateEnv();
      expect(result.ok).toBe(true);
      expect(result.criticalErrors).toHaveLength(0);
    });
  });

  it("fails when DATABASE_URL is missing", () => {
    withEnv({ ...FULL_VALID_ENV, DATABASE_URL: undefined }, () => {
      expect(() => validateEnv()).toThrow("process.exit called");
    });
  });

  it("allows missing OPENROUTER_API_KEY when VProxy Anthropic is enabled", () => {
    withEnv(
      {
        ...FULL_VALID_ENV,
        OPENROUTER_API_KEY: undefined,
        USE_VPROXY_ANTHROPIC: "true",
      },
      () => {
        const result = validateEnv();
        expect(result.ok).toBe(true);
      },
    );
  });

  it("fails when OPENROUTER_API_KEY is missing and VProxy Anthropic is disabled", () => {
    withEnv(
      {
        ...FULL_VALID_ENV,
        OPENROUTER_API_KEY: undefined,
        USE_VPROXY_ANTHROPIC: "false",
      },
      () => {
        expect(() => validateEnv()).toThrow("process.exit called");
      },
    );
  });

  it("accepts NEON_DATABASE_URL as DATABASE_URL alias", () => {
    withEnv(
      {
        ...FULL_VALID_ENV,
        DATABASE_URL: undefined,
        NEON_DATABASE_URL: "postgresql://u:p@h/db",
      },
      () => {
        const result = validateEnv();
        expect(result.ok).toBe(true);
        expect(process.env.DATABASE_URL).toBe("postgresql://u:p@h/db");
      },
    );
  });

  it('fails when ENABLE_CENTRAL_SCORING is not exactly "true"', () => {
    withEnv({ ...FULL_VALID_ENV, ENABLE_CENTRAL_SCORING: "false" }, () => {
      expect(() => validateEnv()).toThrow("process.exit called");
    });
  });

  it('fails when ENABLE_CENTRAL_SCORING is "True" (case sensitive)', () => {
    withEnv({ ...FULL_VALID_ENV, ENABLE_CENTRAL_SCORING: "True" }, () => {
      expect(() => validateEnv()).toThrow("process.exit called");
    });
  });

  it("blocks BYPASS_AUTH in production", () => {
    withEnv({ ...FULL_VALID_ENV, BYPASS_AUTH: "true" }, () => {
      expect(() => validateEnv()).toThrow("process.exit called");
    });
  });

  it("warns but does not exit when OPTIONAL vars are missing", () => {
    withEnv({ ...FULL_VALID_ENV, FRED_API_KEY: undefined }, () => {
      const result = validateEnv();
      expect(result.ok).toBe(true);
      expect(result.warnings.some((w) => w.includes("FRED_API_KEY"))).toBe(
        true,
      );
    });
  });

  it("warns on partial LiveKit config", () => {
    withEnv(
      {
        ...FULL_VALID_ENV,
        LIVEKIT_API_KEY: "key",
        LIVEKIT_API_SECRET: undefined,
        LIVEKIT_URL: undefined,
      },
      () => {
        const result = validateEnv();
        expect(result.warnings.some((w) => w.includes("Partial LiveKit"))).toBe(
          true,
        );
      },
    );
  });
});
