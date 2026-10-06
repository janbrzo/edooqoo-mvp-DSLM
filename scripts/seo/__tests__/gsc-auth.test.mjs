import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GSC_READONLY_SCOPE,
  buildJwtAssertion,
  exchangeServiceAccountToken,
  parseServiceAccount,
  resolveBearerToken,
} from '../seo-monitoring-utils.mjs';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const account = { client_email: 'gsc-reader@example.iam.gserviceaccount.com', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' };
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('parseServiceAccount', () => {
  it('accepts raw JSON, base64 JSON and keys with escaped newlines', () => {
    const json = JSON.stringify(account);
    expect(parseServiceAccount(json).client_email).toBe(account.client_email);
    expect(parseServiceAccount(Buffer.from(json).toString('base64')).private_key).toBe(privateKey);
    const escaped = JSON.stringify({ ...account, private_key: privateKey.replace(/\n/g, '\\n') });
    expect(parseServiceAccount(escaped).private_key).toBe(privateKey);
  });
  it('returns null when unset and fails clearly when malformed', () => {
    expect(parseServiceAccount('')).toBeNull();
    expect(() => parseServiceAccount('not json')).toThrow(/neither valid JSON/);
    expect(() => parseServiceAccount('{"client_email":"a@b"}')).toThrow(/missing client_email or private_key/);
  });
});

describe('buildJwtAssertion', () => {
  it('signs a read-only JWT that the public key verifies', () => {
    const jwt = buildJwtAssertion(account, { now: 1_800_000_000 });
    const [header, claims, signature] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: account.client_email,
      scope: GSC_READONLY_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const valid = crypto.createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'));
    expect(valid).toBe(true);
  });
  it('does not leak key material when the key is invalid', () => {
    const bad = { ...account, private_key: '-----BEGIN PRIVATE KEY-----\nSECRETSECRET\n-----END PRIVATE KEY-----' };
    try {
      buildJwtAssertion(bad);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.message).toMatch(/not a valid RSA private key/);
      expect(error.message).not.toMatch(/SECRETSECRET/);
    }
  });
});

describe('exchangeServiceAccountToken / resolveBearerToken', () => {
  const okFetch = (calls) => async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }) };
  };

  it('posts a jwt-bearer grant and returns the access token', async () => {
    const calls = [];
    const token = await exchangeServiceAccountToken(account, { fetchImpl: okFetch(calls), now: 1_800_000_000 });
    expect(token).toBe('ya29.test');
    const body = new URLSearchParams(calls[0].init.body);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(body.get('assertion').split('.')).toHaveLength(3);
  });
  it('reports Google errors without throwing out of resolveBearerToken', async () => {
    const fetchImpl = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }) });
    const result = await resolveBearerToken({ env: { GSC_SERVICE_ACCOUNT_JSON: JSON.stringify(account) }, fetchImpl });
    expect(result.token).toBe('');
    expect(result.error).toMatch(/invalid_grant|Invalid JWT Signature/);
    expect(result.error).not.toMatch(/PRIVATE KEY/);
  });
  it('prefers a ready access token and never calls Google for it', async () => {
    const fetchImpl = async () => {
      throw new Error('must not be called');
    };
    const result = await resolveBearerToken({ env: { GSC_ACCESS_TOKEN: 'direct', GSC_SERVICE_ACCOUNT_JSON: JSON.stringify(account) }, fetchImpl });
    expect(result).toEqual({ token: 'direct', source: 'access-token-env', error: '' });
  });
  it('returns an empty result when nothing is configured', async () => {
    expect(await resolveBearerToken({ env: {} })).toEqual({ token: '', source: 'none', error: '' });
  });
});
