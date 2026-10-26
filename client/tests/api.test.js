import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, getCaseMedia, getHealth, getInvestigation, getInvestigationResult, getMediaContentUrl, getMysteries, getMystery, loginAccount, requestEvidenceMedia, requestInvestigationHint, requestMystery, retryEvidenceMedia, saveInvestigationNotes, startInvestigation, submitInvestigationAccusation, updateInvestigationProgress } from '../src/api/client.js';

afterEach(() => vi.unstubAllGlobals());

describe('frontend API client', () => {
  it('reads the backend health success envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { status: 'ok' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('normalizes API error envelopes for the UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected.' },
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    await expect(apiRequest('/health/ready')).rejects.toMatchObject({
      name: 'ApiError', status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Database is not connected.',
    });
  });

  it('preserves the safe generation error code and request reference for support diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, error: {
        code: 'GENERATED_CASE_SCHEMA_INVALID',
        message: 'Gemini returned a case with missing or incorrectly formatted fields.',
        retryable: true,
        requestId: 'request-123',
      },
    }), { status: 502, headers: { 'Content-Type': 'application/json' } })));
    await expect(requestMystery({ scenario: 'fictional case' })).rejects.toMatchObject({
      code: 'GENERATED_CASE_SCHEMA_INVALID', requestId: 'request-123', retryable: true,
    });
  });

  it('handles an unavailable backend without leaking implementation details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('internal network detail')));
    await expect(getHealth()).rejects.toMatchObject({
      name: 'ApiError', code: 'NETWORK_ERROR', message: 'Unable to reach the investigation service. Please try again.',
    });
  });

  it('sends credentials and JSON for session endpoints and case briefs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { user: { id: 'u1' } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { mystery: { id: 'case-1' } } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { mystery: { id: 'case-1', status: 'playable' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await loginAccount({ email: 'mira@example.com', password: 'long-password' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ email: 'mira@example.com', password: 'long-password' }));
    await expect(requestMystery({ scenario: 'example' })).resolves.toEqual({ mystery: { id: 'case-1' } });
    await expect(getMystery('case-1')).resolves.toEqual({ mystery: { id: 'case-1', status: 'playable' } });
  });

  it('uses authenticated JSON endpoints for investigation progress, notes, hints, verdicts, and results', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => new Response(JSON.stringify({
      success: true,
      data: url.endsWith('/result') ? { verdict: { correct: true } } : { investigation: { id: 'investigation-1' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await getMysteries();
    await startInvestigation('case-1');
    await getInvestigation('investigation-1');
    await updateInvestigationProgress('investigation-1', { inspectedEvidenceIds: ['evidence-1'] });
    await saveInvestigationNotes('investigation-1', { theory: 'A recorded time contradicts the alibi.' });
    await requestInvestigationHint('investigation-1');
    await submitInvestigationAccusation('investigation-1', { suspectId: 'suspect-1', explanation: 'A sufficiently long explanation.' });
    await getInvestigationResult('investigation-1');
    expect(fetchMock).toHaveBeenCalledTimes(8);
    for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe('include');
    expect(fetchMock.mock.calls[3][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[4][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[6][1].body).toContain('suspect-1');
  });
  it('uses authenticated API requests for media generation, status, retries, and secure content URLs', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      const method = options.method ?? 'GET';
      const isMediaList = method === 'GET' && String(url).includes('/media');
      return new Response(JSON.stringify({
        success: true,
        data: isMediaList ? { assets: [] } : { asset: { id: 'asset-1', status: 'pending' } },
      }), { status: method === 'POST' ? 202 : 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await getCaseMedia('case 1', 'evidence/2');
    await requestEvidenceMedia('case 1', 'evidence/2', 'image');
    await retryEvidenceMedia('case 1', 'asset-1');
    expect(getMediaContentUrl('case 1', 'asset-1')).toContain('/mysteries/case%201/media/asset-1/content');
    expect(fetchMock.mock.calls[0][0]).toContain('evidenceId=evidence%2F2');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ mediaType: 'image' });
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
    expect(fetchMock.mock.calls[2][1].method).toBe('POST');
  });

});
