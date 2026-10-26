```javascript
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = 'NETWORK_ERROR',
      details = null,
      requestId = null,
      retryable = status === 0,
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const body =
    hasBody &&
    typeof options.body !== 'string' &&
    !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body;

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
      {
        ...options,
        body,
        headers,
        // Required for cross-origin session cookies (Vercel -> Render).
        credentials: 'include',
      },
    );
  } catch {
    throw new ApiError(
      'Unable to reach the investigation service. Please try again.',
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.error?.message ??
        'The request could not be completed.',
      {
        status: response.status,
        code: payload?.error?.code ?? 'REQUEST_ERROR',
        details: payload?.error?.details ?? null,
        requestId: payload?.error?.requestId ?? null,
        retryable:
          payload?.error?.retryable ??
          (response.status >= 500 || response.status === 429),
      },
    );
  }

  return payload?.data ?? payload;
}

export function getHealth() {
  return apiRequest('/health');
}

export function getCurrentUser() {
  return apiRequest('/auth/me');
}

export function registerAccount(input) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function loginAccount(input) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export function logoutAccount() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  });
}

export function requestMystery(input) {
  return apiRequest('/mysteries', {
    method: 'POST',
    body: input,
  });
}

export function getMystery(id) {
  return apiRequest(`/mysteries/${encodeURIComponent(id)}`);
}

export function getMysteries() {
  return apiRequest('/mysteries');
}

export function startInvestigation(mysteryId) {
  return apiRequest(
    `/mysteries/${encodeURIComponent(mysteryId)}/investigations`,
    { method: 'POST' },
  );
}

export function getInvestigation(id) {
  return apiRequest(`/investigations/${encodeURIComponent(id)}`);
}

export function updateInvestigationProgress(id, input) {
  return apiRequest(
    `/investigations/${encodeURIComponent(id)}/progress`,
    {
      method: 'PATCH',
      body: input,
    },
  );
}

export function saveInvestigationNotes(id, input) {
  return apiRequest(
    `/investigations/${encodeURIComponent(id)}/notes`,
    {
      method: 'PUT',
      body: input,
    },
  );
}

export function requestInvestigationHint(id) {
  return apiRequest(
    `/investigations/${encodeURIComponent(id)}/hints`,
    { method: 'POST' },
  );
}

export function submitInvestigationAccusation(id, input) {
  return apiRequest(
    `/investigations/${encodeURIComponent(id)}/accusations`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export function getInvestigationResult(id) {
  return apiRequest(`/investigations/${encodeURIComponent(id)}/result`);
}

export function getCaseMedia(mysteryId, evidenceId) {
  const query = evidenceId
    ? `?evidenceId=${encodeURIComponent(evidenceId)}`
    : '';

  return apiRequest(
    `/mysteries/${encodeURIComponent(mysteryId)}/media${query}`,
  );
}

export function requestEvidenceMedia(mysteryId, evidenceId, mediaType) {
  return apiRequest(
    `/mysteries/${encodeURIComponent(mysteryId)}/evidence/${encodeURIComponent(evidenceId)}/media`,
    {
      method: 'POST',
      body: { mediaType },
    },
  );
}

export function retryEvidenceMedia(mysteryId, assetId) {
  return apiRequest(
    `/mysteries/${encodeURIComponent(mysteryId)}/media/${encodeURIComponent(assetId)}/retry`,
    { method: 'POST' },
  );
}

export function getMediaContentUrl(mysteryId, assetId) {
  return `${API_BASE_URL}/mysteries/${encodeURIComponent(mysteryId)}/media/${encodeURIComponent(assetId)}/content`;
}
```