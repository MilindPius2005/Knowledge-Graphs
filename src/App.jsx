import ExplorerPage from './pages/ExplorerPage.jsx';
import AuthPage from './components/AuthPage.jsx';
import { useAuthSession } from './hooks/useAuthSession.js';

export default function App() {
  const auth = useAuthSession();

  if (auth.isAuthLoading) {
    return (
      <main className="auth-shell">
        <div className="graph-loading">Loading session...</div>
      </main>
    );
  }

  if (!auth.user) {
    return (
      <AuthPage
        onSignIn={auth.login}
        onSignUp={auth.register}
        error={auth.authError}
        setError={auth.setAuthError}
      />
    );
  }

  return <ExplorerPage user={auth.user} onLogout={auth.logout} />;
}
