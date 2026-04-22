import { createHash, randomBytes } from 'node:crypto';
import { createServerClient } from './supabase-server';

export const API_KEY_PLAINTEXT_LENGTH = 32; // hex chars
export const API_KEY_PREFIX_LENGTH = 12;    // "mz_live_xxxx" — 8 static + 4 dynamic

/**
 * Generates a fresh API key and its derivatives.
 * The plaintext key is shown to the user exactly once and must never be logged.
 */
export function generateApiKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const random = randomBytes(API_KEY_PLAINTEXT_LENGTH / 2).toString('hex');
  const plaintext = `mz_live_${random}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.slice(0, API_KEY_PREFIX_LENGTH);
  return { plaintext, hash, prefix };
}

/**
 * Deterministic hash of an API key. SHA-256 is sufficient because the input
 * is already high-entropy random bytes — there is nothing to brute force.
 */
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export interface ApiKeyValidation {
  valid: boolean;
  owner_id: string | null;
  key_id: string | null;
  reason?: 'missing' | 'bad_format' | 'not_found' | 'revoked';
}

/**
 * Validates an incoming API key against the api_keys table.
 * Returns the owner_id for use in downstream queries and bumps last_used_at.
 */
export async function validateApiKey(key: string | null | undefined): Promise<ApiKeyValidation> {
  if (!key) {
    return { valid: false, owner_id: null, key_id: null, reason: 'missing' };
  }
  if (!key.startsWith('mz_live_')) {
    return { valid: false, owner_id: null, key_id: null, reason: 'bad_format' };
  }

  const supabase = createServerClient();
  const hash = hashApiKey(key);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, owner_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, owner_id: null, key_id: null, reason: 'not_found' };
  }
  if (data.revoked_at) {
    return { valid: false, owner_id: null, key_id: data.id, reason: 'revoked' };
  }

  // Fire-and-forget last_used_at bump — never block the request on this.
  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { valid: true, owner_id: data.owner_id, key_id: data.id };
}

/**
 * Extracts the bearer token from an incoming request's Authorization header,
 * falling back to the x-mandatez-api-key header for SDK compatibility.
 */
export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get('authorization') ?? headers.get('Authorization');
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const direct = headers.get('x-mandatez-api-key');
  if (direct) return direct.trim();
  return null;
}
