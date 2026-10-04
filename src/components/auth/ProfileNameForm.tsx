import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import buttonStyles from '../maps/Maps.module.css';

export function ProfileNameForm({ onReady }: { onReady?: () => void } = {}) {
  const [name, setName] = useState({ firstName: '', lastName: '' });
  const [savedName, setSavedName] = useState(name);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    authService.getProfile().then(profile => {
      if (!active) return;
      setName(profile);
      setSavedName(profile);
    }).catch(error => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your name.');
    }).finally(() => { if (active) { setLoading(false); onReady?.(); } });
    return () => { active = false; };
  }, [attempt, onReady]);

  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  const firstName = normalize(name.firstName);
  const lastName = normalize(name.lastName);
  const unchanged = firstName === savedName.firstName && lastName === savedName.lastName;

  return (
    <section className="mb-6 border-b border-gray-200 pb-6" aria-labelledby="profile-name-title">
      <h4 id="profile-name-title" className="mb-2 font-bold text-carbon-gray-100">Your name</h4>
      <p className="mb-4 text-sm text-gray-600">This name appears on your orders.</p>
      {loading ? <p role="status" className="text-sm text-gray-600">Loading your name…</p> : loadError ? (
        <div>
          <p role="alert" className="text-sm text-red-700">{loadError}</p>
          <button type="button" className="mt-2 min-h-11 px-3 text-sm font-bold text-carbon-blue-60" onClick={() => {
            setLoading(true); setLoadError(''); setAttempt(value => value + 1);
          }}>Retry</button>
        </div>
      ) : (
        <form onSubmit={async event => {
          event.preventDefault();
          if (saving) return;
          setError(''); setSuccess(false);
          if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
            setError('Enter your first and last name (up to 100 characters each).'); return;
          }
          setSaving(true);
          try {
            const profile = await authService.updateProfile(firstName, lastName);
            setName(profile); setSavedName(profile); setSuccess(true);
            window.dispatchEvent(new Event('profile-updated'));
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to save your name.');
          } finally { setSaving(false); }
        }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['firstName', 'lastName'] as const).map(field => (
              <div key={field}>
                <label htmlFor={`profile-${field}`} className="mb-2 block text-sm font-semibold">{field === 'firstName' ? 'First name' : 'Last name'}</label>
                <input id={`profile-${field}`} required maxLength={100} disabled={saving}
                  autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                  value={name[field]} onChange={event => { setName({ ...name, [field]: event.target.value }); setSuccess(false); }}
                  className="w-full border border-gray-400 bg-white px-3 py-3 text-base focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 disabled:bg-gray-100" />
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="mt-3 text-sm text-green-700">Your name has been updated.</p>}
          <button disabled={saving || unchanged} className={`${buttonStyles.primaryButton} mt-4`}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </form>
      )}
    </section>
  );
}
