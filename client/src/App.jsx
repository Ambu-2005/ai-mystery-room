import React from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, getHealth, getMystery, getMysteries, loginAccount, logoutAccount, registerAccount, requestMystery } from './api/client.js';
import { InvestigationPage, InvestigationResultPage } from './features/investigation/InvestigationPages.jsx';
import { getArchiveCasePresentation } from './features/archive/archiveCase.js';

function LandingPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: false });
  return (
    <div className="site-shell">
      <header className="topbar wrap">
        <Link className="brand" to="/" aria-label="AI Mystery Room home"><img className="brand-logo brand-logo-full" src="/mystery-room-logo.png" alt="" /><span>AI MYSTERY<br /><b>ROOM</b></span></Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">The experience</a><a href="#case-preview">Case preview</a><Link to="/login">Sign in</Link><Link to="/register">Join</Link></nav>
        <Link className="nav-cta" to="/mysteries/new">Create a Mystery <span aria-hidden="true">↗</span></Link>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> A NEW KIND OF DETECTIVE STORY</p>
            <h1>Every room keeps<br />a <em>secret.</em></h1>
            <p className="hero-lede">Step into the evidence. Follow the details others missed. Find the truth hidden between the lines.</p>
            <div className="hero-actions"><Link className="button button-gold" to="/mysteries/new">Create a Mystery <span>↗</span></Link><a className="text-link" href="#case-preview">Explore Cases <span>↓</span></a></div>
            <div className="hero-note"><span className="note-rule" /> FICTIONAL MYSTERIES. YOUR DEDUCTION.</div>
          </div>
          <div className="hero-art" role="img" aria-label="A shadowy detective study with a desk lamp and pinned case notes">
            <div className="art-grid" />
            <div className="case-stamp">CASE<br /><strong>NO. 014</strong><br />UNSOLVED</div>
            <div className="evidence evidence-one"><span>EXHIBIT A</span><b>ROOM 07</b><small>LAST ENTRY · 21:14</small></div>
            <div className="evidence evidence-two"><span>TRANSCRIPT</span><b>“I heard nothing.”</b><small>WITNESS STATEMENT</small></div>
            <div className="lamp-glow" />
            <div className="art-caption"><span>THE MARLOWE HOTEL</span><span>EST. 1928 · PORTLAND</span></div>
          </div>
        </section>

        <section className="ticker" aria-label="Investigation principles"><div className="ticker-track"><span>OBSERVE CLOSELY</span><i>✳</i><span>QUESTION EVERYTHING</span><i>✳</i><span>TRUST THE EVIDENCE</span><i>✳</i><span>OBSERVE CLOSELY</span><i>✳</i><span>QUESTION EVERYTHING</span></div></section>

        <section className="intro-section wrap" id="how-it-works">
          <div><p className="eyebrow">YOUR INVESTIGATION BEGINS HERE</p><h2>Not just a story.<br /><em>A case to crack.</em></h2></div>
          <p className="section-copy">Enter a carefully built fictional mystery, examine the details, and decide what happened. Generated cases are validated before they enter your archive, where private notes and evidence connections stay with your investigation.</p>
        </section>

        <section className="feature-grid wrap" aria-label="Planned investigation features">
          <article className="feature-card"><span className="feature-icon">⌕</span><span className="feature-index">01 / OBSERVE</span><h3>Every detail<br />has a place.</h3><p>Explore the scene, inspect the evidence, and notice the small things that change everything.</p><span className="feature-state">INVESTIGATION TOOLS · IN DEVELOPMENT</span></article>
          <article className="feature-card"><span className="feature-icon">⌁</span><span className="feature-index">02 / CONNECT</span><h3>Follow the<br />threads.</h3><p>Compare accounts, map the timeline, and test each theory against what you know.</p><span className="feature-state">CASE WORKSPACE · IN DEVELOPMENT</span></article>
          <article className="feature-card"><span className="feature-icon">◉</span><span className="feature-index">03 / DEDUCE</span><h3>Make your<br />call.</h3><p>When the clues align, name your suspect and explain how the pieces fit together.</p><span className="feature-state">VERDICT SYSTEM · IN DEVELOPMENT</span></article>
        </section>

        <section className="preview wrap" id="case-preview">
          <div className="preview-top"><div><p className="eyebrow">FROM THE CASE ARCHIVE</p><h2>A glimpse into<br /><em>the unknown.</em></h2></div><span className="preview-badge">FICTIONAL CONCEPT PREVIEW<br />NOT AN AI-GENERATED CASE</span></div>
          <article className="case-card"><div className="case-visual"><div className="window-lines"/><span className="case-number">FILE 001</span><span className="case-visual-title">THE LAST<br />GUEST</span><span className="case-location">MARLOWE HOTEL · ROOM 07</span></div><div className="case-details"><p className="case-kicker">AN ILLUSTRATIVE CASE CONCEPT</p><h3>One locked room.<br />Three stories that don’t add up.</h3><p>A storm-bound hotel. A vanished guest. And a key that should never have left the front desk.</p><div className="case-meta"><span>⏱ &nbsp; APPROX. 30 MIN</span><span>◈ &nbsp; 4 SUSPECTS</span><span>⌖ &nbsp; 12 CLUES</span></div><span className="coming-soon">CASE LIBRARY COMING SOON</span></div></article>
        </section>

        <section className="closing wrap"><p className="eyebrow">THE TRUTH IS IN THERE</p><h2>Ready to think<br /><em>like a detective?</em></h2><Link className="button button-gold" to="/mysteries/new">Create a Mystery <span>↗</span></Link><p className="closing-note">Sign in to generate a case and begin your private investigation.</p></section>
      </main>

      <footer className="footer wrap" id="about"><Link className="brand" to="/" aria-label="AI Mystery Room home"><img className="brand-logo" src="/mystery-room-favicon.png" alt="" /><span>AI MYSTERY<br /><b>ROOM</b></span></Link><p>Fictional cases. Real deduction.</p><div><a href="#about">About</a><a href="#about">Privacy</a><a href="#about">Terms</a><a href="mailto:hello@mysteryroom.example">Contact</a></div><small>© 2026 THE MYSTERY ROOM · AN INVESTIGATION IN IMAGINATION · SERVICE {health.isSuccess ? 'CONNECTED' : health.isPending ? 'CHECKING' : 'OFFLINE'}</small></footer>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const session = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser, retry: false });
  if (session.isPending) return <main className="auth-stage"><div className="auth-card"><p className="eyebrow">SECURE SESSION</p><p role="status">Checking your session…</p></div></main>;
  if (session.isError) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: isRegister ? registerAccount : loginAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    },
  });
  const [form, setForm] = React.useState({ name: '', email: '', password: '' });
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(isRegister ? form : { email: form.email, password: form.password });
  };

  return <main className="auth-stage wrap"><section className="auth-card"><Link className="back-link" to="/">← Back to the room</Link><p className="eyebrow">{isRegister ? 'CREATE YOUR INVESTIGATOR FILE' : 'INVESTIGATOR ACCESS'}</p><h1>{isRegister ? 'Join the room.' : 'Welcome back.'}</h1><p className="auth-copy">{isRegister ? 'Save your place for the cases ahead.' : 'Sign in to continue to your private case room.'}</p>
    <form className="auth-form" onSubmit={submit}>
      {isRegister && <label>Investigator name<input name="name" autoComplete="name" minLength="2" maxLength="80" required value={form.name} onChange={update} /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required value={form.email} onChange={update} /></label>
      <label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 10 : 1} maxLength="128" required value={form.password} onChange={update} />{isRegister && <small>Use at least 10 characters.</small>}</label>
      {mutation.isError && <p className="form-alert" role="alert">{mutation.error.message}</p>}
      <button className="button button-gold auth-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Securing your session…' : isRegister ? 'Create account' : 'Sign in'} <span>↗</span></button>
    </form>
    <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to the room?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
  </section></main>;
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser, retry: false });
  const mysteries = useQuery({ queryKey: ['mysteries'], queryFn: getMysteries, retry: false });
  const logout = useMutation({ mutationFn: logoutAccount, onSuccess: async () => {
    queryClient.setQueryData(['currentUser'], null);
    await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    navigate('/', { replace: true });
  } });
  return <main className="member-page wrap"><header className="member-header"><div><p className="eyebrow">PRIVATE INVESTIGATOR FILE</p><h1>Welcome, {session.data?.user?.name}.</h1></div><button className="quiet-button" onClick={() => logout.mutate()} disabled={logout.isPending}>{logout.isPending ? 'Signing out…' : 'Sign out'}</button></header>
    {logout.isError && <p className="form-alert" role="alert">{logout.error.message} You can retry signing out.</p>}
    <section className="archive-section"><div className="archive-heading"><div><p className="eyebrow">CASE ARCHIVE</p><h2>Your investigations</h2></div><Link to="/mysteries/new" className="button button-gold">Create a Mystery <span>↗</span></Link></div>
      {mysteries.isPending && <p role="status" className="generation-status"><span className="generation-spinner" /> Loading your cases…</p>}
      {mysteries.isError && <div className="form-alert" role="alert">{mysteries.error.message} <button className="inline-retry" onClick={() => mysteries.refetch()}>Try again</button></div>}
      {mysteries.isSuccess && mysteries.data.mysteries.length === 0 && <div className="empty-case"><span className="feature-icon">⌕</span><h3>Your case file is waiting.</h3><p>Generated cases appear here once Gemini has validated them and MongoDB has saved them.</p></div>}
      {mysteries.isSuccess && mysteries.data.mysteries.length > 0 && <div className="archive-grid">{mysteries.data.mysteries.map((mystery) => {
        const archive = getArchiveCasePresentation(mystery);
        return <article className="archive-case" key={mystery.id}><div className="archive-case-heading"><p className="eyebrow">{mystery.difficulty.toUpperCase()} · {mystery.genre.replaceAll('-', ' ')}</p><span className={`archive-status ${archive.statusClass}`}>{archive.statusLabel}</span></div><h3>{mystery.title}</h3><p>{mystery.description}</p><small>{mystery.setting.location} · {mystery.suspectCount} suspects · {mystery.evidenceCount} evidence items</small>{archive.finalScore !== null && <p className="archive-score"><b>{archive.finalScore}</b><span>Final score</span></p>}<div className="archive-actions"><Link className="quiet-button" to={`/mysteries/${encodeURIComponent(mystery.id)}`}>Case overview</Link><Link className="button button-gold" to={archive.actionTo}>{archive.actionLabel} →</Link></div></article>;
      })}</div>}
    </section>
  </main>;
}

const initialMysteryForm = { title: '', scenario: '', genre: 'detective', difficulty: 'medium', suspectCount: '4', evidenceRichness: 'standard', preferredSetting: '' };

function MysteryCreationPage() {
  const [form, setForm] = React.useState(initialMysteryForm);
  const [fieldErrors, setFieldErrors] = React.useState({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: requestMystery,
    retry: false,
    onSuccess: async ({ mystery }) => {
      await queryClient.invalidateQueries({ queryKey: ['mysteries'] });
      navigate(`/mysteries/${mystery.id}`, { replace: true });
    },
  });
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const validate = () => {
    const errors = {};
    const scenarioLength = form.scenario.trim().length;
    if (scenarioLength < 50 || scenarioLength > 2000) errors.scenario = 'Enter between 50 and 2,000 characters.';
    if (!['detective', 'college-mystery', 'heist', 'missing-object', 'locked-room', 'historical', 'corporate'].includes(form.genre)) errors.genre = 'Choose a listed genre.';
    if (!['easy', 'medium', 'hard'].includes(form.difficulty)) errors.difficulty = 'Choose a listed difficulty.';
    if (![3, 4, 5, 6].includes(Number(form.suspectCount))) errors.suspectCount = 'Choose between 3 and 6 suspects.';
    if (!['standard', 'detailed'].includes(form.evidenceRichness)) errors.evidenceRichness = 'Choose a listed evidence detail level.';
    if (form.title.trim().length > 120) errors.title = 'The title must be 120 characters or fewer.';
    if (form.preferredSetting.trim().length > 160) errors.preferredSetting = 'The setting must be 160 characters or fewer.';
    return errors;
  };
  const submit = (event) => {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    mutation.mutate({ ...form, suspectCount: Number(form.suspectCount), contentRating: 'teen', language: 'en' });
  };
  const retryable = mutation.error?.retryable;
  return <main className="member-page wrap"><Link className="back-link" to="/dashboard">← Back to your file</Link><div className="create-heading"><p className="eyebrow">NEW INVESTIGATION · BRIEFING</p><h1>Set the scene.</h1><p>Describe the fictional incident and choose how you want to investigate it. Gemini will build and validate one complete case before it is saved.</p></div>
    <form className="creation-form" onSubmit={submit}>
      <label>Case title <span className="optional">OPTIONAL</span><input name="title" maxLength="120" value={form.title} onChange={update} placeholder="A name for your case" />{fieldErrors.title && <small className="count-invalid">{fieldErrors.title}</small>}</label>
      <label>Scenario <span className="required-label">50–2,000 CHARACTERS</span><textarea name="scenario" rows="6" minLength="50" maxLength="2000" required value={form.scenario} onChange={update} aria-invalid={Boolean(fieldErrors.scenario)} aria-describedby="scenario-hint" placeholder="Describe the fictional incident, setting, or mystery you want to investigate…" /><small id="scenario-hint" className={fieldErrors.scenario ? 'count-invalid' : ''}>{fieldErrors.scenario || `${form.scenario.trim().length} / 2,000 · at least 50 characters`}</small></label>
      <div className="form-grid"><label>Genre<select name="genre" value={form.genre} onChange={update}><option value="detective">Classic detective</option><option value="college-mystery">College mystery</option><option value="heist">Heist</option><option value="missing-object">Missing object</option><option value="locked-room">Locked-room mystery</option><option value="historical">Historical mystery</option><option value="corporate">Corporate mystery</option></select>{fieldErrors.genre && <small className="count-invalid">{fieldErrors.genre}</small>}</label>
      <label>Difficulty<select name="difficulty" value={form.difficulty} onChange={update}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>{fieldErrors.difficulty && <small className="count-invalid">{fieldErrors.difficulty}</small>}</label>
      <label>Suspects<select name="suspectCount" value={form.suspectCount} onChange={update}>{[3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} suspects</option>)}</select>{fieldErrors.suspectCount && <small className="count-invalid">{fieldErrors.suspectCount}</small>}</label>
      <label>Evidence detail<select name="evidenceRichness" value={form.evidenceRichness} onChange={update}><option value="standard">Standard</option><option value="detailed">Detailed</option></select>{fieldErrors.evidenceRichness && <small className="count-invalid">{fieldErrors.evidenceRichness}</small>}</label>
      <label className="full-field">Preferred setting <span className="optional">OPTIONAL</span><input name="preferredSetting" maxLength="160" value={form.preferredSetting} onChange={update} placeholder="e.g. A remote mountain hotel" />{fieldErrors.preferredSetting && <small className="count-invalid">{fieldErrors.preferredSetting}</small>}</label></div>
      <p className="teen-note">Content rating: Teen-friendly · Language: English</p>
      {mutation.isError && <div className="form-alert" role="alert"><strong>Case not created.</strong><br />{mutation.error.message}{mutation.error.details && <ul>{Object.entries(mutation.error.details).flatMap(([field, messages]) => messages.map((message) => <li key={`${field}-${message}`}>{field}: {message}</li>))}</ul>} {mutation.error.requestId && <small>Reference ID: {mutation.error.requestId}</small>} {retryable ? 'Your brief remains in this form. You can retry.' : 'Your brief remains in this form.'}</div>}
      {mutation.isPending && <div className="generation-status" role="status" aria-live="polite"><span className="generation-spinner" /> Gemini is building the case and checking its clues and timeline. This can take a few minutes; keep this page open.</div>}
      <div className="generation-actions"><button className="button button-gold create-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Generating mystery…' : mutation.isError && retryable ? 'Retry generation' : 'Create a Mystery'} <span>↗</span></button></div>
      <p className="create-disclaimer">A mystery is saved only after Gemini output passes consistency checks and MongoDB confirms both case and private solution storage.</p>
    </form>
  </main>;
}

function MysteryOverviewPage() {
  const { id } = useParams();
  const mysteryQuery = useQuery({ queryKey: ['mystery', id], queryFn: () => getMystery(id) });
  if (mysteryQuery.isPending) return <main className="member-page wrap"><p className="generation-status" role="status"><span className="generation-spinner" /> Opening your case file…</p></main>;
  if (mysteryQuery.isError) return <main className="member-page wrap"><Link className="back-link" to="/dashboard">← Back to your file</Link><div className="form-alert" role="alert">{mysteryQuery.error.message} <button className="inline-retry" onClick={() => mysteryQuery.refetch()}>Try again</button></div></main>;
  const { mystery } = mysteryQuery.data;
  return <main className="member-page wrap mystery-overview"><Link className="back-link" to="/dashboard">← Back to your file</Link><p className="eyebrow">PLAYABLE CASE · {mystery.difficulty.toUpperCase()}</p><h1>{mystery.title}</h1><p className="overview-description">{mystery.description}</p><div className="overview-facts"><span>{mystery.genre.replaceAll('-', ' ')}</span><span>{mystery.setting.location}</span><span>INCIDENT · {mystery.setting.incidentTime}</span></div>
    <section className="overview-section"><p className="eyebrow">THE INCIDENT</p><h2>{mystery.incident.objective}</h2><p>{mystery.incident.description}</p></section>
    <section className="overview-section"><p className="eyebrow">PERSONS OF INTEREST · {mystery.suspects.length}</p><div className="overview-cards">{mystery.suspects.map((suspect) => <article className="overview-card" key={suspect.id}><span className="feature-index">{suspect.role}</span><h3>{suspect.name}</h3><p>{suspect.biography}</p><p><b>Alibi</b> · {suspect.alibi}</p><p><b>Motive</b> · {suspect.motive}</p></article>)}</div></section>
    <section className="overview-section"><p className="eyebrow">TIMELINE</p><ol className="case-timeline">{mystery.timeline.map((event) => <li key={event.id}><time>{event.timestamp}</time><span>{event.description}</span></li>)}</ol></section>
    <section className="overview-section"><p className="eyebrow">EVIDENCE · {mystery.evidence.length} ITEMS</p><p>Evidence starts as text. Open an investigation to generate optional visual evidence and CCTV-style clips for individual clues.</p><div className="overview-cards">{mystery.evidence.map((item) => <article className="overview-card evidence-summary" key={item.id}><span className="feature-index">{item.type === 'cctv' ? 'CCTV TEXT RECORD · NO VIDEO' : item.type === 'photograph' ? 'PHOTO DESCRIPTION · NO IMAGE' : item.type.replaceAll('-', ' ')} · {item.reliability} reliability</span><h3>{item.title}</h3><p>{item.description}</p><details><summary>Inspect evidence</summary><p>{item.content}</p><small>Location: {item.location}{item.timestamp ? ` · ${item.timestamp}` : ''}</small></details></article>)}</div></section>
    <section className="overview-next"><div><strong>Your case is saved and playable.</strong><p>Inspect the evidence, connect clues, and record your theory in a private investigation file.</p></div><Link className="button button-gold" to={`/mysteries/${encodeURIComponent(mystery.id)}/investigate`}>Enter investigation →</Link></section>
  </main>;
}

function NotFound() {
  return <main className="not-found wrap"><p className="eyebrow">FILE NOT FOUND</p><h1>This trail ends here.</h1><Link className="button button-gold" to="/">Return to the room ↗</Link></main>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/mysteries/new" element={<ProtectedRoute><MysteryCreationPage /></ProtectedRoute>} />
    <Route path="/mysteries/:id" element={<ProtectedRoute><MysteryOverviewPage /></ProtectedRoute>} />
    <Route path="/mysteries/:id/investigate" element={<ProtectedRoute><InvestigationPage /></ProtectedRoute>} />
    <Route path="/investigations/:id/result" element={<ProtectedRoute><InvestigationResultPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
