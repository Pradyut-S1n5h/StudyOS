import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, PlugZap, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { AiConfigurationStatus, AiDiagnostics, api } from '../../services/api';

type ConnectionState = 'checking' | 'not-configured' | 'configured' | 'testing' | 'connected' | 'failed' | 'unavailable';

const statusLabels: Record<ConnectionState, string> = {
  checking: 'Checking server',
  'not-configured': 'Not configured',
  configured: 'Saved, not tested',
  testing: 'Testing connection',
  connected: 'Connected',
  failed: 'Connection failed',
  unavailable: 'Service unavailable',
};

const diagnosticLabels: Record<string, string> = {
  backend: 'Backend availability',
  configuration: 'Provider configuration',
  authentication: 'Provider authentication',
  model: 'Model availability',
  generation: 'Actual text generation',
  response: 'Response processing',
};

export const AISettingsView: React.FC = () => {
  const [configuration, setConfiguration] = useState<AiConfigurationStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<ConnectionState>('checking');
  const [diagnostics, setDiagnostics] = useState<AiDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getAiConfiguration().then((result) => {
      if (!active) return;
      setConfiguration(result);
      setStatus(result.configured ? 'configured' : 'not-configured');
    }).catch(() => {
      if (active) setStatus('unavailable');
    });
    return () => { active = false; };
  }, []);

  const announceStatus = (nextStatus: ConnectionState) => {
    window.dispatchEvent(new CustomEvent('studyos_ai_status', { detail: { status: nextStatus } }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.saveAiConfiguration({
        provider: 'google',
        model: configuration?.model || 'gemini-2.5-flash',
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setConfiguration((current) => current ? { ...current, configured: true, model: saved.model } : {
        configured: true,
        provider: 'google',
        model: saved.model,
        supportedModels: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
      });
      setApiKey('');
      setShowKey(false);
      setDiagnostics(null);
      setStatus('configured');
      announceStatus('configured');
      setMessage('Settings saved on this StudyOS server. Test the connection before using AI.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Settings could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setStatus('testing');
    setError('');
    setMessage('');
    announceStatus('testing');
    try {
      const result = await api.runAiDiagnostics();
      setDiagnostics(result);
      const nextStatus = result.passed ? 'connected' : 'failed';
      setStatus(nextStatus);
      announceStatus(nextStatus);
      setMessage(result.passed
        ? 'A real test prompt was generated and parsed successfully.'
        : 'One or more checks failed. Review the results below before retrying.');
    } catch (testError) {
      setStatus('unavailable');
      announceStatus('unavailable');
      setError(testError instanceof Error ? testError.message : 'The diagnostics request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the saved AI provider key from this StudyOS server?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.removeAiConfiguration();
      setConfiguration((current) => current ? { ...current, configured: false } : null);
      setApiKey('');
      setDiagnostics(null);
      setStatus('not-configured');
      announceStatus('not-configured');
      setMessage('The saved key was removed.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'The key could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Settings</p>
        <h1 className="mt-1 text-2xl font-bold text-white">AI Configuration</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Connect Google Gemini once to enable the assistant, notes, explanations, grounded questions, quizzes, and answer grading.</p>
      </header>

      <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Provider connection</h2>
            <p className="mt-1 text-xs text-slate-400">AI requests are sent from this server to the selected provider.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200" aria-live="polite">
            {status === 'testing' || status === 'checking'
              ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
              : status === 'connected'
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : status === 'failed' || status === 'unavailable'
              ? <XCircle className="h-4 w-4 text-rose-400" />
              : <PlugZap className="h-4 w-4 text-amber-400" />}
            <span>{statusLabels[status]}</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-300">
              AI provider
              <select value="google" disabled className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 disabled:opacity-100">
                <option value="google">Google Gemini</option>
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">Google Gemini is the currently integrated provider.</span>
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Model
              <select
                value={configuration?.model || 'gemini-3.8-flash'}
                onChange={(event) => setConfiguration((current) => current ? { ...current, model: event.target.value } : current)}
                disabled={!configuration || busy}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 disabled:opacity-60"
              >
                {(configuration?.supportedModels || ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro']).map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
              <span className="mt-1 block text-[11px] text-slate-500">Flash is the lower-latency, lower-cost default.</span>
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-300" htmlFor="gemini-api-key">
            Google AI API key {configuration?.configured && <span className="font-normal text-slate-500">(leave blank to keep the saved key)</span>}
            <span className="mt-1.5 flex rounded-lg border border-slate-700 bg-slate-950 focus-within:border-cyan-500">
              <input
                id="gemini-api-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={configuration?.configured ? 'Saved securely on this server' : 'Paste your Google AI API key'}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
              />
              <button type="button" onClick={() => setShowKey((visible) => !visible)} className="px-3 text-slate-400 hover:text-white" aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || (!configuration?.configured && !apiKey.trim())} className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? 'Working…' : configuration?.configured ? 'Save settings' : 'Save key'}
            </button>
            <button type="button" onClick={handleTest} disabled={busy || !configuration?.configured} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {status === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {configuration?.configured && <button type="button" onClick={handleRemove} disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"><Trash2 className="h-4 w-4" />Remove key</button>}
          </div>
        </form>

        {(message || error) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${error ? 'border-rose-900 bg-rose-950/30 text-rose-200' : 'border-emerald-900 bg-emerald-950/30 text-emerald-200'}`}>
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{error || message}
        </div>}

        <div className="border-t border-slate-800 pt-4 text-xs text-slate-400">
          <p>Get a key from <a className="text-cyan-300 underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>. Provider usage and quota are managed by Google and are not exposed through this app.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-100">AI system diagnostics</h2>
          <p className="mt-1 text-xs text-slate-400">Connection testing sends a real, minimal prompt to the selected model.</p>
        </div>
        {diagnostics ? <div className="divide-y divide-slate-800">
          {Object.entries(diagnostics.results).map(([key, result]) => <div key={key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {result.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
            <div><p className="text-sm font-medium text-slate-200">{diagnosticLabels[key] || key}</p><p className="mt-0.5 text-xs text-slate-400">{result.message}</p></div>
            <span className={`ml-auto text-[10px] font-bold uppercase ${result.passed ? 'text-emerald-400' : 'text-rose-300'}`}>{result.passed ? 'Pass' : 'Fail'}</span>
          </div>)}
        </div> : <p className="text-xs text-slate-500">Run “Test connection” to check the backend, credentials, model, generation, and response parsing.</p>}
      </section>

      <aside className="flex items-start gap-3 rounded-lg border border-slate-800 px-4 py-3 text-xs text-slate-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        <p>The key is encrypted on the server and is never sent back to browser code. This application has no user sign-in, so this configuration is shared by everyone who can reach this StudyOS server. Keep a hosted instance behind trusted access controls.</p>
      </aside>
    </div>
  );
};