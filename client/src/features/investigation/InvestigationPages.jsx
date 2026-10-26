import React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getInvestigationResult,
  getCaseMedia,
  getMediaContentUrl,
  requestInvestigationHint,
  requestEvidenceMedia,
  retryEvidenceMedia,
  saveInvestigationNotes,
  startInvestigation,
  submitInvestigationAccusation,
  updateInvestigationProgress,
} from '../../api/client.js';
import { getEvidenceTimelineContext } from './evidenceMapping.js';
import MediaEvidence from '../../components/MediaEvidence.jsx';

const sections = [
  ['overview', 'Case overview'],
  ['suspects', 'Suspects'],
  ['timeline', 'Timeline'],
  ['evidence', 'Evidence'],
  ['board', 'Evidence board'],
  ['notes', 'Detective notes'],
  ['verdict', 'Final verdict'],
];

function clockMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function chronologicalEvents(events) {
  return [...events].sort((a, b) => {
    const left = clockMinutes(a.timestamp) ?? 0;
    const right = clockMinutes(b.timestamp) ?? 0;
    return left - right || String(a.id).localeCompare(String(b.id));
  });
}

function alibiClockRanges(alibi) {
  return [...(alibi ?? '').matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|to|until|through)\s*([01]?\d|2[0-3]):([0-5]\d)\b/gi)]
    .map((match) => [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])]);
}

function findPossibleContradictions(mystery) {
  const events = chronologicalEvents(mystery.timeline);
  return mystery.suspects.flatMap((suspect) => {
    const ranges = alibiClockRanges(suspect.alibi);
    if (!ranges.length) return [];
    return events.filter((event) => event.suspectIds.includes(suspect.id)).flatMap((event) => {
      const minute = clockMinutes(event.timestamp);
      const overlaps = ranges.some(([start, end]) => start <= end
        ? minute >= start && minute <= end
        : minute >= start || minute <= end);
      if (!overlaps) return [];
      const alibiLocation = /\b(?:at|in|inside|near)\s+(?:the\s+)?([a-z][a-z '-]{2,50})/i.exec(suspect.alibi)?.[1]?.trim().replace(/[.,;].*$/, '').toLowerCase();
      if (!alibiLocation) return [];
      const eventEvidence = mystery.evidence.filter((item) => item.timelineEventId === event.id && item.relatedSuspectIds.includes(suspect.id));
      const locationConflict = eventEvidence.find((item) => {
        const clueLocation = item.location.toLowerCase();
        return clueLocation && !clueLocation.includes(alibiLocation) && !alibiLocation.includes(clueLocation);
      });
      return locationConflict ? [{ id: `${event.id}:${suspect.id}`, event, suspect, alibiLocation, evidence: locationConflict }] : [];
    });
  });
}

function InvestigationShell({ children, title, status = 'ACTIVE INVESTIGATION' }) {
  return <main className="investigation-page wrap">
    <header className="investigation-top"><Link className="back-link" to="/dashboard">← Case archive</Link><span className="investigation-status">{status}</span></header>
    <p className="eyebrow">PRIVATE CASE FILE</p><h1>{title}</h1>{children}
  </main>;
}

export function InvestigationPage() {
  const { id: mysteryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ['investigation-case', mysteryId];
  const query = useQuery({ queryKey, queryFn: () => startInvestigation(mysteryId), retry: false });
  const [section, setSection] = React.useState('overview');
  const [selectedEvidenceId, setSelectedEvidenceId] = React.useState('');
  const [timelineSuspectFilter, setTimelineSuspectFilter] = React.useState('all');
  const [timelineRange, setTimelineRange] = React.useState({ from: '', to: '' });
  const [evidenceCategory, setEvidenceCategory] = React.useState('all');
  const [evidenceStatus, setEvidenceStatus] = React.useState('all');
  const [notesDraft, setNotesDraft] = React.useState({ general: '', theory: '', evidence: {}, suspects: {} });
  const [accusation, setAccusation] = React.useState({ suspectId: '', explanation: '', supportingEvidenceIds: [] });
  const [confirmingVerdict, setConfirmingVerdict] = React.useState(false);
  const mediaQuery = useQuery({
    queryKey: ['case-media', mysteryId, selectedEvidenceId],
    queryFn: () => getCaseMedia(mysteryId, selectedEvidenceId),
    enabled: section === 'evidence' && Boolean(query.data?.mystery && selectedEvidenceId),
    refetchInterval: (currentQuery) => currentQuery.state.data?.assets?.some((asset) => ['pending', 'processing'].includes(asset.status)) ? 2000 : false,
    retry: false,
  });
  const generateMedia = useMutation({
    mutationFn: ({ evidenceId, mediaType }) => requestEvidenceMedia(mysteryId, evidenceId, mediaType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-media', mysteryId] }),
  });
  const retryMedia = useMutation({
    mutationFn: (assetId) => retryEvidenceMedia(mysteryId, assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-media', mysteryId] }),
  });

  React.useEffect(() => {
    const investigation = query.data?.investigation;
    if (!investigation) return;
    setNotesDraft({
      general: investigation.userNotes?.find(({ id: noteId }) => noteId === 'case-notes')?.text ?? '',
      theory: investigation.theory ?? '',
      evidence: Object.fromEntries((investigation.evidenceNotes ?? []).map(({ evidenceId, note }) => [evidenceId, note])),
      suspects: Object.fromEntries((investigation.suspectNotes ?? []).map(({ suspectId, note }) => [suspectId, note])),
    });
  }, [query.data?.investigation?.id]);

  const updateProgress = useMutation({
    mutationFn: (patch) => updateInvestigationProgress(query.data.investigation.id, patch),
    onSuccess: (investigation) => queryClient.setQueryData(queryKey, (previous) => ({ ...previous, investigation })),
  });
  const saveNotes = useMutation({
    mutationFn: () => saveInvestigationNotes(query.data.investigation.id, {
      userNotes: notesDraft.general.trim() ? [{ id: 'case-notes', text: notesDraft.general }] : [],
      theory: notesDraft.theory,
      evidenceNotes: Object.entries(notesDraft.evidence).filter(([, note]) => note.trim()).map(([evidenceId, note]) => ({ evidenceId, note })),
      suspectNotes: Object.entries(notesDraft.suspects).filter(([, note]) => note.trim()).map(([suspectId, note]) => ({ suspectId, note })),
    }),
    onSuccess: (investigation) => queryClient.setQueryData(queryKey, (previous) => ({ ...previous, investigation })),
  });
  const requestHint = useMutation({
    mutationFn: () => requestInvestigationHint(query.data.investigation.id),
    onSuccess: (result) => queryClient.setQueryData(queryKey, (previous) => ({ ...previous, investigation: result.investigation })),
  });
  const submitVerdict = useMutation({
    mutationFn: () => submitInvestigationAccusation(query.data.investigation.id, accusation),
    onSuccess: () => navigate(`/investigations/${encodeURIComponent(query.data.investigation.id)}/result`),
  });

  if (query.isPending) return <InvestigationShell title="Opening the investigation"><p className="generation-status" role="status"><span className="generation-spinner" /> Loading your private case file…</p></InvestigationShell>;
  if (query.isError) return <InvestigationShell title="The case file is unavailable"><div className="form-alert" role="alert">{query.error.message}</div><button className="button button-gold" onClick={() => query.refetch()}>Try again</button></InvestigationShell>;
  if (query.data.investigation.status === 'completed') return <InvestigationShell title="This investigation is complete" status="VERDICT SUBMITTED"><p>Your final accusation has been recorded.</p><Link className="button button-gold" to={`/investigations/${encodeURIComponent(query.data.investigation.id)}/result`}>Review final result →</Link></InvestigationShell>;

  const { mystery, investigation } = query.data;
  const sortedEvents = chronologicalEvents(mystery.timeline);
  const possibleContradictions = findPossibleContradictions(mystery);
  const selectedEvidence = mystery.evidence.find(({ id: evidenceId }) => evidenceId === selectedEvidenceId);
  const selectedEvidenceTimeline = selectedEvidence ? getEvidenceTimelineContext(mystery, selectedEvidence) : null;
  const error = updateProgress.error ?? saveNotes.error ?? requestHint.error ?? submitVerdict.error;
  const markInspected = (evidenceId) => {
    if (investigation.inspectedEvidenceIds.includes(evidenceId)) return;
    updateProgress.mutate({ inspectedEvidenceIds: [...investigation.inspectedEvidenceIds, evidenceId] });
  };
  const toggleBookmark = (evidenceId) => {
    const current = investigation.bookmarkedEvidenceIds;
    updateProgress.mutate({ bookmarkedEvidenceIds: current.includes(evidenceId) ? current.filter((idValue) => idValue !== evidenceId) : [...current, evidenceId] });
  };
  const toggleAssociation = (evidenceId, suspectId) => {
    const current = investigation.evidenceSuspectLinks;
    const exists = current.some((link) => link.evidenceId === evidenceId && link.suspectId === suspectId);
    updateProgress.mutate({ evidenceSuspectLinks: exists
      ? current.filter((link) => link.evidenceId !== evidenceId || link.suspectId !== suspectId)
      : [...current, { evidenceId, suspectId }] });
  };
  const setSelectedEvidence = (evidenceId) => {
    setSelectedEvidenceId(evidenceId);
    markInspected(evidenceId);
  };
  return <InvestigationShell title={mystery.title}>
    <div className="investigation-summary"><p>{mystery.description}</p><div><span>{mystery.difficulty} case</span><span>{investigation.inspectedEvidenceIds.length} of {mystery.evidence.length} evidence inspected</span><span>{investigation.progress}% complete</span></div><div className="progress-track" role="progressbar" aria-label="Evidence inspected" aria-valuemin="0" aria-valuemax={mystery.evidence.length} aria-valuenow={investigation.inspectedEvidenceIds.length}><span style={{ width: `${investigation.progress}%` }} /></div></div>

    <nav className="investigation-nav" aria-label="Investigation sections">{sections.map(([key, label]) => <button type="button" key={key} aria-pressed={section === key} className={section === key ? 'is-active' : ''} onClick={() => setSection(key)}>{label}</button>)}</nav>
    {error && <p className="form-alert" role="alert">{error.message}</p>}
    {updateProgress.isPending && <p role="status" className="save-status">Saving investigation progress…</p>}

    {section === 'overview' && <section className="investigation-panel" aria-labelledby="case-brief-heading">
      <p className="eyebrow">CASE BRIEF</p><h2 id="case-brief-heading">{mystery.incident.objective}</h2><p>{mystery.incident.description}</p><p className="muted-copy">{mystery.scenario}</p>
      <div className="investigation-hints"><div><p className="eyebrow">OPTIONAL FIELD NOTES</p><h3>Need a nudge?</h3><p>Hints point you back to the evidence. They do not name a suspect.</p></div><button type="button" className="quiet-button" onClick={() => requestHint.mutate()} disabled={requestHint.isPending || investigation.hintHistory.length >= 2}>{requestHint.isPending ? 'Reviewing clues…' : 'Reveal next hint'}</button></div>
      {investigation.hintHistory.length > 0 && <ol className="hint-list">{investigation.hintHistory.map((hint) => <li key={hint.level}><b>Hint {hint.level}</b><span>{hint.text}</span></li>)}</ol>}
      <Link className="text-link" to={`/mysteries/${encodeURIComponent(mysteryId)}`}>Return to case overview →</Link>
    </section>}

    {section === 'suspects' && <section className="investigation-panel" aria-labelledby="suspects-heading"><p className="eyebrow">PERSONS OF INTEREST · {mystery.suspects.length}</p><h2 id="suspects-heading">Suspect profiles</h2><div className="investigation-cards">{mystery.suspects.map((suspect) => <article className="investigation-card" key={suspect.id}><span className="feature-index">{suspect.role}</span><h3>{suspect.name}</h3><p>{suspect.appearance}</p><p>{suspect.biography}</p><p><b>Claimed alibi</b> · {suspect.alibi}</p><p><b>Known motive</b> · {suspect.motive}</p><p className="muted-copy">Relevant evidence: {suspect.evidenceIds.map((evidenceId) => mystery.evidence.find((item) => item.id === evidenceId)?.title).filter(Boolean).join(', ')}</p></article>)}</div></section>}

    {section === 'timeline' && <section className="investigation-panel" aria-labelledby="timeline-heading"><p className="eyebrow">EVENT LOG · OFFICIAL CASE FACTS</p><h2 id="timeline-heading">Timeline</h2><div className="board-filters"><label>Suspect<select value={timelineSuspectFilter} onChange={(event) => setTimelineSuspectFilter(event.target.value)}><option value="all">All suspects</option>{mystery.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>{suspect.name}</option>)}</select></label><label>From<input type="time" value={timelineRange.from} onChange={(event) => setTimelineRange((range) => ({ ...range, from: event.target.value }))} /></label><label>To<input type="time" value={timelineRange.to} onChange={(event) => setTimelineRange((range) => ({ ...range, to: event.target.value }))} /></label><button type="button" className="quiet-button" onClick={() => { setTimelineSuspectFilter('all'); setTimelineRange({ from: '', to: '' }); }}>Clear filters</button></div><ol className="event-timeline">{sortedEvents.filter((event) => timelineSuspectFilter === 'all' || event.suspectIds.includes(timelineSuspectFilter)).filter((event) => { const minute = clockMinutes(event.timestamp); const from = clockMinutes(timelineRange.from); const to = clockMinutes(timelineRange.to); return (from === null || minute >= from) && (to === null || minute <= to); }).map((event) => {
      const suspects = event.suspectIds.map((id) => mystery.suspects.find((suspect) => suspect.id === id)).filter(Boolean);
      const clues = mystery.evidence.filter((item) => item.timelineEventId === event.id);
      return <li key={event.id}><time dateTime={event.timestamp}>{event.timestamp}</time><div className="event-copy"><p>{event.description}</p><p className="event-location">{[...new Set(clues.map((clue) => clue.location).filter(Boolean))].join(' · ') || mystery.setting.location}</p><div className="event-relations"><div><b>Evidence</b>{clues.length ? clues.map((clue) => <button type="button" key={clue.id} onClick={() => { setSelectedEvidenceId(clue.id); markInspected(clue.id); setSection('evidence'); }}>{clue.title}</button>) : <span>None linked</span>}</div><div><b>Suspects</b>{suspects.length ? suspects.map((suspect) => <span key={suspect.id}>{suspect.name}</span>) : <span>None named</span>}</div></div></div></li>;
    })}</ol>{possibleContradictions.length > 0 && <aside className="possible-contradictions"><p className="eyebrow">LEADS TO INVESTIGATE · NOT CONCLUSIONS</p><h3>Possible alibi contradictions</h3>{possibleContradictions.map(({ id, event, suspect, alibiLocation, evidence }) => <article key={id}><b>{suspect.name} · {event.timestamp}</b><p>The alibi names “{alibiLocation}” during a time range that includes this event, while linked evidence places a related record at “{evidence.location}”. Check whether these refer to the same place or moment; this is only a possible mismatch.</p><button type="button" className="text-link" onClick={() => { setTimelineSuspectFilter(suspect.id); setTimelineRange({ from: event.timestamp, to: event.timestamp }); }}>Investigate this time</button><button type="button" className="text-link" onClick={() => { setSelectedEvidenceId(evidence.id); markInspected(evidence.id); setSection('evidence'); }}>Inspect {evidence.title}</button></article>)}</aside>}</section>}

    {section === 'evidence' && <section className="investigation-panel" aria-labelledby="evidence-heading"><p className="eyebrow">CASE MATERIAL</p><h2 id="evidence-heading">Inspect evidence</h2><p className="muted-copy">Generate visual evidence for a clue. Mock images and unavailable video providers are labelled clearly; only items marked AI-generated come from the configured AI provider.</p><div className="board-filters"><label>Category<select value={evidenceCategory} onChange={(event) => setEvidenceCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(mystery.evidence.map((item) => item.type))].sort().map((type) => <option key={type} value={type}>{type.replaceAll('-', ' ')}</option>)}</select></label><label>Inspection<select value={evidenceStatus} onChange={(event) => setEvidenceStatus(event.target.value)}><option value="all">All clues</option><option value="inspected">Inspected</option><option value="uninspected">Uninspected</option></select></label></div><div className="evidence-workspace"><div className="evidence-picker" role="list" aria-label="Evidence items">{mystery.evidence.filter((item) => evidenceCategory === 'all' || item.type === evidenceCategory).filter((item) => evidenceStatus === 'all' || investigation.inspectedEvidenceIds.includes(item.id) === (evidenceStatus === 'inspected')).map((item) => <button type="button" role="listitem" key={item.id} disabled={updateProgress.isPending} aria-pressed={selectedEvidenceId === item.id} className={selectedEvidenceId === item.id ? 'is-selected' : ''} onClick={() => setSelectedEvidence(item.id)}><span>{item.type.replaceAll('-', ' ')} · {item.reliability} reliability</span><b>{item.title}</b><small>{investigation.inspectedEvidenceIds.includes(item.id) ? 'Inspected' : 'Uninspected'}{investigation.bookmarkedEvidenceIds.includes(item.id) ? ' · Bookmarked' : ''}</small></button>)}</div>
      {selectedEvidence ? <article className="evidence-detail" aria-live="polite"><p className="eyebrow">{selectedEvidence.type.replaceAll('-', ' ').toUpperCase()}</p><h3>{selectedEvidence.title}</h3><p>{selectedEvidence.description}</p><div className="evidence-fulltext">{selectedEvidence.content}</div><p className="muted-copy">Found at {selectedEvidence.location}{selectedEvidenceTimeline.evidenceTimestamp ? ` · Evidence timestamp ${selectedEvidenceTimeline.evidenceTimestamp}` : ''}</p><section className="evidence-event" aria-label="Related timeline event"><h4>Related timeline event</h4>{selectedEvidenceTimeline.event ? <><p><time>{selectedEvidenceTimeline.event.timestamp}</time></p><p>{selectedEvidenceTimeline.event.description}</p></> : <p>This evidence has no linked timeline event.</p>}</section>
        <section className="evidence-media-tools" aria-labelledby="visual-evidence-heading"><p className="eyebrow">OPTIONAL MEDIA</p><h4 id="visual-evidence-heading">Visual evidence</h4><p className="muted-copy">Request an illustration or short CCTV-style clip for this evidence item. Generation may take several minutes and may incur API charges when real providers are enabled.</p><div className="evidence-media-actions"><button type="button" className="quiet-button" onClick={() => generateMedia.mutate({ evidenceId: selectedEvidence.id, mediaType: 'image' })} disabled={generateMedia.isPending || (mediaQuery.data?.assets ?? []).some((asset) => asset.mediaType === 'image' && ['pending', 'processing', 'ready'].includes(asset.status))}>{generateMedia.isPending ? 'Requesting media…' : 'Generate image'}</button><button type="button" className="quiet-button" onClick={() => generateMedia.mutate({ evidenceId: selectedEvidence.id, mediaType: 'video' })} disabled={generateMedia.isPending || (mediaQuery.data?.assets ?? []).some((asset) => asset.mediaType === 'video' && ['pending', 'processing', 'ready'].includes(asset.status))}>Generate CCTV video</button></div>
          {mediaQuery.isPending && <p className="save-status" role="status">Loading saved media…</p>}
          {mediaQuery.isError && <p className="form-alert" role="alert">{mediaQuery.error.message}</p>}
          {generateMedia.isError && <p className="form-alert" role="alert">{generateMedia.error.message}</p>}
          {retryMedia.isError && <p className="form-alert" role="alert">{retryMedia.error.message}</p>}
          {(mediaQuery.data?.assets ?? []).length === 0 && !mediaQuery.isPending && <p className="muted-copy">No media has been generated for this item yet.</p>}
          <div className="evidence-media-list">{(mediaQuery.data?.assets ?? []).map((asset) => <MediaEvidence key={asset.id} asset={asset} timestamp={asset.eventTimestamp ?? selectedEvidenceTimeline.evidenceTimestamp} src={asset.status === 'ready' ? getMediaContentUrl(mysteryId, asset.id) : undefined} onRetry={(assetId) => retryMedia.mutate(assetId)} />)}</div>
        </section>
        <button type="button" className="quiet-button" onClick={() => toggleBookmark(selectedEvidence.id)} disabled={updateProgress.isPending}>{investigation.bookmarkedEvidenceIds.includes(selectedEvidence.id) ? 'Remove bookmark' : 'Bookmark evidence'}</button><label className="field-label">Private note for this evidence<textarea value={notesDraft.evidence[selectedEvidence.id] ?? ''} maxLength="2000" onChange={(event) => setNotesDraft((current) => ({ ...current, evidence: { ...current.evidence, [selectedEvidence.id]: event.target.value } }))} rows="3" /></label><button type="button" className="quiet-button" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>{saveNotes.isPending ? 'Saving note…' : 'Save evidence note'}</button></article>
      : <p className="empty-board">Choose an evidence item to inspect its full details.</p>}</div></section>}

    {section === 'board' && <section className="investigation-panel" aria-labelledby="board-heading"><p className="eyebrow">DEDUCTION BOARD</p><h2 id="board-heading">Connect clues, people, and time</h2><p className="muted-copy">Official links come from the case file. Gold dashed links and your notes are private theories saved to this investigation.</p><div className="board-grid">{mystery.evidence.map((item) => {
      const event = mystery.timeline.find(({ id: eventId }) => eventId === item.timelineEventId);
      const linkedSuspects = investigation.evidenceSuspectLinks.filter((link) => link.evidenceId === item.id).map((link) => link.suspectId);
      return <article className="board-note" key={item.id}><button type="button" className="board-evidence" disabled={updateProgress.isPending} onClick={() => { setSelectedEvidence(item.id); setSection('evidence'); markInspected(item.id); }}>{item.title}</button><p>{event?.timestamp} · {event?.description}</p><p className="board-links"><b>Officially related clues</b>{item.relatedEvidenceIds.map((evidenceId) => mystery.evidence.find((linked) => linked.id === evidenceId)).filter(Boolean).map((clue) => <button type="button" key={clue.id} onClick={() => { setSelectedEvidenceId(clue.id); setSection('evidence'); markInspected(clue.id); }}>{clue.title}</button>)}</p><p className="board-links"><b>Officially related suspects</b>{(item.relatedSuspectIds ?? []).map((id) => mystery.suspects.find((suspect) => suspect.id === id)).filter(Boolean).map((suspect) => <span className="official-relation" key={suspect.id}>{suspect.name}</span>)}{!(item.relatedSuspectIds ?? []).length && <span>No official suspect link</span>}</p><p className="board-links theory-links"><b>Your suspect links</b>{linkedSuspects.map((id) => mystery.suspects.find((suspect) => suspect.id === id)).filter(Boolean).map((suspect) => <span key={suspect.id}>{suspect.name}</span>)}{!linkedSuspects.length && <span>None yet</span>}</p><fieldset><legend>Your theory · associate suspects</legend>{mystery.suspects.map((suspect) => <label key={suspect.id}><input type="checkbox" disabled={updateProgress.isPending} checked={linkedSuspects.includes(suspect.id)} onChange={() => toggleAssociation(item.id, suspect.id)} />{suspect.name}</label>)}</fieldset><label className="field-label board-note-input">Private clue note<textarea rows="2" maxLength="2000" value={notesDraft.evidence[item.id] ?? ''} onChange={(change) => setNotesDraft((current) => ({ ...current, evidence: { ...current.evidence, [item.id]: change.target.value } }))} /></label><button type="button" className="quiet-button" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>{saveNotes.isPending ? 'Saving…' : 'Save clue note'}</button></article>;
    })}</div></section>}

    {section === 'notes' && <section className="investigation-panel" aria-labelledby="notes-heading"><p className="eyebrow">PRIVATE NOTEBOOK</p><h2 id="notes-heading">Your working theory</h2><div className="notes-grid"><label className="field-label">Case notes<textarea rows="7" maxLength="5000" value={notesDraft.general} onChange={(event) => setNotesDraft((current) => ({ ...current, general: event.target.value }))} placeholder="Record observations and contradictions…" /></label><label className="field-label">Current theory<textarea rows="5" maxLength="3000" value={notesDraft.theory} onChange={(event) => setNotesDraft((current) => ({ ...current, theory: event.target.value }))} placeholder="What do you think happened?" /></label><label className="field-label">Suspect note<select value={mystery.suspects.some(({ id: suspectId }) => suspectId === Object.keys(notesDraft.suspects)[0]) ? Object.keys(notesDraft.suspects)[0] : mystery.suspects[0].id} onChange={(event) => setNotesDraft((current) => ({ ...current, selectedSuspect: event.target.value }))}>{mystery.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>{suspect.name}</option>)}</select><textarea rows="3" maxLength="2000" value={notesDraft.suspects[notesDraft.selectedSuspect ?? Object.keys(notesDraft.suspects)[0] ?? mystery.suspects[0].id] ?? ''} onChange={(event) => setNotesDraft((current) => ({ ...current, suspects: { ...current.suspects, [current.selectedSuspect ?? Object.keys(current.suspects)[0] ?? mystery.suspects[0].id]: event.target.value } }))} placeholder="Private note about this suspect" /></label></div><button type="button" className="button button-gold" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>{saveNotes.isPending ? 'Saving notes…' : 'Save private notes'}</button>{saveNotes.isSuccess && <span className="save-status" role="status">Saved to your investigation.</span>}</section>}

    {section === 'verdict' && <section className="investigation-panel" aria-labelledby="verdict-heading"><p className="eyebrow">FINAL ACCUSATION</p><h2 id="verdict-heading">Who is responsible?</h2><p>Your verdict is final for this investigation. Review your suspect, explanation, and selected evidence before confirming.</p><form className="verdict-form" onSubmit={(event) => { event.preventDefault(); setConfirmingVerdict(true); }}><label className="field-label">Select a suspect<select required value={accusation.suspectId} onChange={(event) => setAccusation((current) => ({ ...current, suspectId: event.target.value }))}><option value="">Choose a suspect</option>{mystery.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>{suspect.name}</option>)}</select></label><fieldset><legend>Supporting evidence (optional)</legend><div className="verdict-evidence">{mystery.evidence.map((item) => <label key={item.id}><input type="checkbox" checked={accusation.supportingEvidenceIds.includes(item.id)} onChange={() => setAccusation((current) => ({ ...current, supportingEvidenceIds: current.supportingEvidenceIds.includes(item.id) ? current.supportingEvidenceIds.filter((idValue) => idValue !== item.id) : [...current.supportingEvidenceIds, item.id] }))} />{item.title}</label>)}</div></fieldset><label className="field-label">Explain your reasoning<textarea required minLength="20" maxLength="3000" rows="6" value={accusation.explanation} onChange={(event) => setAccusation((current) => ({ ...current, explanation: event.target.value }))} placeholder="Explain how the evidence supports your accusation…" /><small>At least 20 characters. Your explanation is saved with your final verdict.</small></label><p className="score-note">Scoring: culprit 60 points · reasoning up to 25 · supporting evidence up to 15.</p><button className="button button-gold" type="submit" disabled={submitVerdict.isPending || !accusation.suspectId || accusation.explanation.trim().length < 20}>Review final verdict</button></form>{confirmingVerdict && <section className="verdict-review" aria-label="Review final accusation"><p className="eyebrow">FINAL REVIEW</p><h3>You accuse {mystery.suspects.find(({ id: suspectId }) => suspectId === accusation.suspectId)?.name}</h3><p>{accusation.explanation}</p><p><b>Supporting evidence:</b> {accusation.supportingEvidenceIds.map((evidenceId) => mystery.evidence.find((item) => item.id === evidenceId)?.title).filter(Boolean).join(', ') || 'None selected'}</p><p>This action cannot be changed after submission.</p><div className="archive-actions"><button type="button" className="quiet-button" onClick={() => setConfirmingVerdict(false)} disabled={submitVerdict.isPending}>Edit accusation</button><button type="button" className="button button-gold" onClick={() => submitVerdict.mutate()} disabled={submitVerdict.isPending}>{submitVerdict.isPending ? 'Submitting verdict…' : 'Confirm and submit'}</button></div></section>}</section>}
  </InvestigationShell>;
}

export function InvestigationResultPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['investigation-result', id], queryFn: () => getInvestigationResult(id), retry: false });
  if (query.isPending) return <main className="member-page wrap"><p className="generation-status" role="status"><span className="generation-spinner" /> Reviewing the verdict…</p></main>;
  if (query.isError) return <main className="member-page wrap"><Link className="back-link" to="/dashboard">← Case archive</Link><div className="form-alert" role="alert">{query.error.message}</div></main>;
  const { investigation, verdict } = query.data;
  return <main className="investigation-page wrap result-page">
    <Link className="back-link" to={`/mysteries/${encodeURIComponent(investigation.mysteryId)}`}>← Case overview</Link>
    <header className="result-header"><p className="eyebrow">INVESTIGATION COMPLETE</p><h1>{verdict.correct ? 'The evidence holds.' : 'The case is solved.'}</h1><p className="overview-description">{verdict.feedback}</p></header>

    <section className="result-score" aria-labelledby="result-score-heading">
      <div className="result-score-value"><span className="score-value">{verdict.score}<small>/100</small></span><p className="eyebrow" id="result-score-heading">FINAL SCORE</p></div>
      <div className="result-score-breakdown"><div><b>{verdict.scoreBreakdown.culprit}<small>/60</small></b><span>Culprit</span></div><div><b>{verdict.scoreBreakdown.explanation}<small>/25</small></b><span>Explanation</span></div><div><b>{verdict.scoreBreakdown.evidence}<small>/15</small></b><span>Evidence</span></div></div>
      <p className="result-score-note">Reasoning points use explanation length; evidence points reflect the decisive clues you selected.</p>
    </section>

    <section className="result-culprit" aria-labelledby="result-culprit-heading">
      <p className="eyebrow">OFFICIAL CASE SOLUTION</p><h2 id="result-culprit-heading">{verdict.correctSuspect?.name ?? 'Culprit identified'}</h2><p className="result-culprit-caption">The person responsible</p>
      <div className="result-culprit-facts"><article><h3>Motive</h3><p>{verdict.solution.motive}</p></article><article><h3>Method</h3><p>{verdict.solution.method}</p></article></div>
    </section>

    <section className="result-section" aria-labelledby="decisive-evidence-heading"><p className="eyebrow">THE RECORD</p><h2 id="decisive-evidence-heading">Decisive evidence</h2><ol className="result-evidence-list">{verdict.solution.decisiveEvidence.map((item) => <li key={item.id}><span className="result-list-index">KEY CLUE</span><div><h3>{item.title}</h3><p>{item.description}</p></div></li>)}</ol><h3 className="result-subheading">How the evidence fits together</h3><ol className="solution-reasoning">{verdict.solution.reasoning.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol></section>

    <div className="result-secondary-grid">
      <section className="result-section result-secondary" aria-labelledby="misleading-clues-heading"><p className="eyebrow">REVISIT THE RED HERRINGS</p><h2 id="misleading-clues-heading">Misleading clues</h2><ul className="result-explanation-list">{verdict.solution.redHerringExplanations.map((item, index) => <li key={`${index}-${item.evidence}`}><b>{item.evidence}</b><p>{item.explanation}</p></li>)}</ul></section>
      <section className="result-section result-secondary" aria-labelledby="other-suspects-heading"><p className="eyebrow">ALTERNATIVE LEADS</p><h2 id="other-suspects-heading">Other suspects</h2><ul className="result-explanation-list">{verdict.solution.suspectExclusions.map((item) => <li key={item.suspectId}><b>{item.suspectName ?? item.suspectId.replace(/^suspect[_-]/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</b><p>{item.explanation}</p></li>)}</ul></section>
    </div>
    <Link className="button button-gold result-return" to="/dashboard">Return to case archive</Link>
  </main>;
}
