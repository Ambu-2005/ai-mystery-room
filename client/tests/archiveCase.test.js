import { describe, expect, it } from 'vitest';
import { getArchiveCasePresentation } from '../src/features/archive/archiveCase.js';

const mystery = { id: 'case-123' };

describe('case archive card state', () => {
  it('offers the existing investigation for an in-progress case', () => {
    expect(getArchiveCasePresentation({ ...mystery, investigation: { id: 'investigation-1', status: 'active', hasVerdict: false, score: null } }))
      .toEqual({
        statusLabel: 'In Progress', statusClass: 'is-in-progress',
        actionLabel: 'Continue Investigation', actionTo: '/mysteries/case-123/investigate', finalScore: null,
      });
  });

  it('links completed cases to their own saved verdict and shows an available score', () => {
    expect(getArchiveCasePresentation({ ...mystery, investigation: { id: 'inv/saved', status: 'completed', hasVerdict: true, score: 87 } }))
      .toEqual({
        statusLabel: 'Completed', statusClass: 'is-completed',
        actionLabel: 'View Final Verdict', actionTo: '/investigations/inv%2Fsaved/result', finalScore: 87,
      });
  });

  it('does not treat a completed status without a saved verdict as complete', () => {
    expect(getArchiveCasePresentation({ ...mystery, investigation: { id: 'investigation-1', status: 'completed', hasVerdict: false, score: 100 } }))
      .toMatchObject({ statusLabel: 'In Progress', actionLabel: 'Continue Investigation', finalScore: null });
  });
});
