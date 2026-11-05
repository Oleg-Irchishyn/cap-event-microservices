import type { AuthorizeParams } from '../authorize-request.service';
import { OIDC_BASE_PATH } from '../oidc-config.service';

export type LoginMode = 'login' | 'register';

/** Escapes every character that is significant in HTML text and quoted attributes. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const STYLE = `
  body{font-family:system-ui,sans-serif;background:#f3f4f6;display:flex;justify-content:center;padding-top:10vh;margin:0}
  main{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.15);width:320px}
  h1{font-size:1.25rem;margin:0 0 1rem}
  label{display:block;font-size:.85rem;margin-top:.75rem}
  input[type=email],input[type=password],input[type=text]{width:100%;box-sizing:border-box;padding:.5rem;margin-top:.25rem}
  button{margin-top:1.25rem;width:100%;padding:.6rem;background:#2563eb;color:#fff;border:0;border-radius:4px;cursor:pointer}
  .error{background:#fee2e2;color:#991b1b;padding:.5rem;border-radius:4px;margin-bottom:.75rem;font-size:.85rem}
  .note{font-size:.75rem;color:#6b7280;margin-top:1rem}
  a{color:#2563eb}
`;

const page = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>` +
  `<body><main>${body}</main></body></html>`;

/** Request parameters carried through the form as hidden fields (snake_case, as received). */
const hiddenFields = (
  p: AuthorizeParams,
): Record<string, string | undefined> => ({
  client_id: p.clientId,
  redirect_uri: p.redirectUri,
  response_type: p.responseType,
  scope: p.scope,
  state: p.state,
  resource: p.resource,
  code_challenge: p.codeChallenge,
  code_challenge_method: p.codeChallengeMethod,
  nonce: p.nonce,
  prompt: p.prompt,
});

export interface LoginPageOptions {
  params: AuthorizeParams;
  mode: LoginMode;
  error?: string;
  email?: string;
  name?: string;
}

export const renderLoginPage = (opts: LoginPageOptions): string => {
  const { params, mode, error, email, name } = opts;
  const fields = hiddenFields(params);

  const hidden = Object.entries(fields)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`,
    )
    .join('');

  const otherMode: LoginMode = mode === 'login' ? 'register' : 'login';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) query.set(key, value);
  }
  query.set('mode', otherMode);
  const toggleHref = `${OIDC_BASE_PATH}/auth?${query.toString()}`;

  const isRegister = mode === 'register';
  const nameField = isRegister
    ? `<label>Name<input type="text" name="name" required maxlength="100" autocomplete="name" value="${escapeHtml(name ?? '')}"></label>`
    : '';

  return page(
    isRegister ? 'Create account' : 'Sign in',
    `<h1>${isRegister ? 'Create account' : 'Sign in'}</h1>` +
      (error
        ? `<div class="error" role="alert">${escapeHtml(error)}</div>`
        : '') +
      `<form method="post" action="${OIDC_BASE_PATH}/auth">` +
      hidden +
      `<input type="hidden" name="mode" value="${mode}">` +
      nameField +
      `<label>Email<input type="email" name="email" required maxlength="254" autocomplete="username" value="${escapeHtml(email ?? '')}"></label>` +
      `<label>Password<input type="password" name="password" required maxlength="72" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>` +
      `<button type="submit">${isRegister ? 'Create account' : 'Sign in'}</button></form>` +
      `<p class="note">${
        isRegister ? 'Already have an account?' : 'No account yet?'
      } <a href="${escapeHtml(toggleHref)}">${isRegister ? 'Sign in' : 'Create one'}</a></p>` +
      `<p class="note">Local development identity provider (fake OneLogin).</p>`,
  );
};

export const renderMessagePage = (title: string, message: string): string =>
  page(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
