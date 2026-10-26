export function getArchiveCasePresentation(mystery) {
  const investigation = mystery.investigation;
  const completed = investigation?.status === 'completed' && investigation.hasVerdict === true;
  return {
    statusLabel: completed ? 'Completed' : 'In Progress',
    statusClass: completed ? 'is-completed' : 'is-in-progress',
    actionLabel: completed ? 'View Final Verdict' : 'Continue Investigation',
    actionTo: completed
      ? `/investigations/${encodeURIComponent(investigation.id)}/result`
      : `/mysteries/${encodeURIComponent(mystery.id)}/investigate`,
    finalScore: completed && Number.isFinite(investigation.score) ? investigation.score : null,
  };
}
