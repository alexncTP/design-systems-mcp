/**
 * Minimal OAuth 2.0 Implementation for Claude Desktop
 *
 * This is "anonymous OAuth" - it provides OAuth endpoints to satisfy
 * Claude Desktop's requirements but doesn't actually authenticate users.
 * Anyone can get a token and all tokens are valid.
 */

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

// In-memory token storage (tokens are valid for 1 year)
const tokens = new Map<string, OAuthToken>();

// In-memory authorization code storage (short-lived, 10 minutes)
const authCodes = new Map<string, { redirect_uri: string; created_at: number }>();

/**
 * OAuth Authorization Server Metadata
 * https://datatracker.ietf.org/doc/html/rfc8414
 */
export function getAuthorizationServerMetadata(origin: string): any {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/**
 * OAuth Protected Resource Metadata
 * https://datatracker.ietf.org/doc/html/rfc8707
 */
export function getProtectedResourceMetadata(origin: string): any {
  return {
    resource: `${origin}/mcp`, // Updated to Streamable HTTP endpoint
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/`,
  };
}

/**
 * Validate a redirect_uri before redirecting to it.
 *
 * There is no client registry (anonymous OAuth), so we can't pin exact
 * callback URLs. We still enforce RFC 8252-style rules: https for web
 * callbacks, http only for loopback addresses, and custom app schemes
 * (claude://, cursor://, vscode://, ...) for native MCP clients. This
 * blocks javascript:/data: injection and plain-http interception.
 */
function isAllowedRedirectUri(redirectUri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return false;
  }

  const scheme = parsed.protocol;
  if (scheme === 'https:') {
    return true;
  }
  if (scheme === 'http:') {
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  }
  // Custom app schemes for native clients; explicitly reject script-capable schemes
  const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];
  return !dangerous.includes(scheme);
}

/**
 * Handle OAuth authorization request
 * Auto-approves and returns authorization code
 */
export function handleAuthorizeRequest(url: URL, origin: string): Response {
  const params = url.searchParams;
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  const responseType = params.get('response_type');

  // Validate required parameters
  if (!redirectUri || responseType !== 'code') {
    return new Response('Invalid request', { status: 400 });
  }

  if (!isAllowedRedirectUri(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400 });
  }

  // Generate authorization code
  const code = crypto.randomUUID();
  authCodes.set(code, {
    redirect_uri: redirectUri,
    created_at: Date.now()
  });

  // Clean up expired codes (older than 10 minutes)
  cleanupExpiredAuthCodes();

  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  // Auto-approve: redirect immediately with code
  return Response.redirect(redirectUrl.toString(), 302);
}

/**
 * Handle OAuth token request
 * Issues access token for authorization code
 */
export function handleTokenRequest(request: Request): Response {
  try {
    // Token requests are POST with form data
    if (request.method !== 'POST') {
      return jsonResponse({
        error: 'invalid_request',
        error_description: 'Token endpoint only accepts POST requests'
      }, 400);
    }

    // Parse form data (we'll handle this in the main handler)
    return new Response('Token endpoint ready', { status: 200 });

  } catch (error: any) {
    console.error('[OAuth] Token request error:', error);
    return jsonResponse({
      error: 'server_error',
      error_description: error.message
    }, 500);
  }
}

/**
 * Process token request with parsed form data
 */
export async function processTokenRequest(formData: any): Promise<Response> {
  const grantType = formData.get('grant_type');
  const code = formData.get('code');
  const redirectUri = formData.get('redirect_uri');

  // Validate grant type
  if (grantType !== 'authorization_code') {
    return jsonResponse({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code grant type is supported'
    }, 400);
  }

  if (!code) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Missing authorization code'
    }, 400);
  }

  // If we still hold this code (same isolate), verify redirect URI matches
  // and consume it. If we don't hold it, the authorize request likely landed
  // on a different Workers isolate — since this is anonymous OAuth (all
  // tokens are accepted anyway), issue the token rather than spuriously
  // failing the flow with invalid_grant.
  const authCode = authCodes.get(code);
  if (authCode) {
    if (redirectUri !== authCode.redirect_uri) {
      return jsonResponse({
        error: 'invalid_grant',
        error_description: 'Redirect URI mismatch'
      }, 400);
    }
    // Delete used code (one-time use)
    authCodes.delete(code);
  }

  // Generate access token
  const accessToken = crypto.randomUUID();
  const expiresIn = 365 * 24 * 60 * 60; // 1 year

  const token: OAuthToken = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    created_at: Date.now()
  };

  // Store token
  tokens.set(accessToken, token);

  // Clean up expired tokens
  cleanupExpiredTokens();

  // Return token response
  return jsonResponse({
    access_token: token.access_token,
    token_type: token.token_type,
    expires_in: token.expires_in
  }, 200);
}

/**
 * Validate Bearer token from Authorization header
 * Returns true if token is valid (or if no auth required)
 *
 * NOTE: This is "anonymous OAuth" - we accept all Bearer tokens
 * because tokens are not persisted across Worker instances.
 * This maintains OAuth UI compatibility while allowing public access.
 */
export function validateBearerToken(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');

  // No auth header? Accept anyway (for backwards compatibility)
  if (!authHeader) {
    return true;
  }

  // Parse Bearer token format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false; // Invalid format
  }

  // Anonymous OAuth: Accept all Bearer tokens
  // Tokens are stored in-memory and lost across Worker restarts,
  // so we can't reliably validate them. Since this is public access
  // anyway, accept any properly formatted Bearer token.
  return true;
}

/**
 * Clean up authorization codes older than 10 minutes
 */
function cleanupExpiredAuthCodes(): void {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [code, data] of authCodes.entries()) {
    if (now - data.created_at > maxAge) {
      authCodes.delete(code);
    }
  }
}

/**
 * Clean up expired tokens (older than expiration time)
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();

  for (const [token, data] of tokens.entries()) {
    const expiresAt = data.created_at + (data.expires_in * 1000);
    if (now > expiresAt) {
      tokens.delete(token);
    }
  }
}

/**
 * Helper to create JSON responses
 */
function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    }
  });
}
