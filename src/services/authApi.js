const AUTH_STORAGE_KEY = 'ontology-explorer-auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function shouldUseMock() {
  return import.meta.env.VITE_USE_MOCK_AUTH === 'true' || !API_BASE_URL;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

// Used only for local/mock authentication. Avoids hard failing when crypto.subtle
// is unavailable (older runtimes / non-secure contexts).
async function digestPassword(password, salt) {
  const subtle = globalThis?.crypto?.subtle;

  // Preferred path: SHA-256 via WebCrypto
  if (subtle?.digest) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const hashBuffer = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback: deterministic non-cryptographic hash (prevents runtime crash).
  // This keeps the “normal sign-in page” working with mock auth.
  let h = 2166136261;
  const s = `${salt}:${password}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(16).padStart(8, '0');
}

function readMockUsers() {
  return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{"users":[],"session":null}');
}

function writeMockUsers(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function signUp({ name, email, password }) {
  if (!shouldUseMock()) {
    return requestJson('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  const store = readMockUsers();
  const cleanEmail = email.trim().toLowerCase();

  if (store.users.some((user) => user.email === cleanEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const salt = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const user = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    name: name.trim(),
    email: cleanEmail,
    role: 'Explorer',
    salt,
    passwordHash: await digestPassword(password, salt),
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  store.session = user.id;
  writeMockUsers(store);
  return { user: publicUser(user) };
}

export async function signIn({ email, password }) {
  if (!shouldUseMock()) {
    return requestJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  const store = readMockUsers();
  const cleanEmail = email.trim().toLowerCase();
  const user = store.users.find((candidate) => candidate.email === cleanEmail);

  if (!user || user.passwordHash !== (await digestPassword(password, user.salt))) {
    throw new Error('Invalid email or password.');
  }

  store.session = user.id;
  writeMockUsers(store);
  return { user: publicUser(user) };
}

export async function getSession() {
  if (!shouldUseMock()) return requestJson('/auth/me');

  const store = readMockUsers();
  const user = store.users.find((candidate) => candidate.id === store.session);
  return { user: publicUser(user) };
}

export async function signOut() {
  if (!shouldUseMock()) return requestJson('/auth/logout', { method: 'POST' });

  const store = readMockUsers();
  store.session = null;
  writeMockUsers(store);
  return { ok: true };
}

