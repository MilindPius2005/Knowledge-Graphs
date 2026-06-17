import { useState } from 'react';

export default function AuthPage({ onSignIn, onSignUp, error, setError }) {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (mode === 'signup') {
        await onSignUp(form);
      } else {
        await onSignIn({ email: form.email, password: form.password });
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to authenticate.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block auth-brand">
          <div className="brand-mark">OE</div>
          <div>
            <h1>Ontology Explorer</h1>
            <p>Secure graph workspace</p>
          </div>
        </div>

        <div className="mode-toggle auth-toggle" role="group" aria-label="Authentication mode">
          <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
            Sign In
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </label>

          {error ? <div className="error-banner">{error}</div> : null}

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}
