export default function UserPage({ user, onLogout }) {
  return (
    <section className="utility-panel user-page">
      <div>
        <div className="section-heading">User Page</div>
        <h2>{user.name || user.email}</h2>
        <p>Signed in as {user.email}</p>
      </div>

      <div className="details-panel">
        <div>
          <span>Role</span>
          <strong>{user.role || 'Explorer'}</strong>
        </div>
        <div>
          <span>User ID</span>
          <strong>{user.id}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Managed by backend'}</strong>
        </div>
      </div>

      <button type="button" className="secondary-button" onClick={onLogout}>
        Sign Out
      </button>
    </section>
  );
}
