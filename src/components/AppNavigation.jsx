export default function AppNavigation({ activeView, onViewChange, user }) {
  const views = [
    ['explorer', 'Explorer'],
    ['events', 'Events'],
    ['ingestion', 'Ingestion'],
    ['user', user?.name || 'User'],
  ];

  return (
    <nav className="app-nav" aria-label="Application views">
      {views.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? 'active' : ''}
          onClick={() => onViewChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
