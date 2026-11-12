import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, MessageSquarePlus, Send, Settings2, Square, Trash2, UserRound } from 'lucide-react';
import { api, ChatMessage } from '../../services/api';

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = 'studyos_ai_conversations';

function readConversations(): Conversation[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Conversation => item && typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages));
  } catch {
    return [];
  }
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `conversation-${Date.now()}`;
}

export const AIChatView: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const [conversations, setConversations] = useState<Conversation[]>(readConversations);
  const [activeId, setActiveId] = useState(() => readConversations()[0]?.id || '');
  const [input, setInput] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [retryText, setRetryText] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId), [conversations, activeId]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 20))); } catch { /* Local history is optional. */ }
  }, [conversations]);

  useEffect(() => {
    let active = true;
    api.getAiConfiguration().then((result) => { if (active) setConfigured(result.configured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; controllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversation?.messages, isSending]);

  const updateConversation = (id: string, update: (conversation: Conversation) => Conversation) => {
    setConversations((current) => current.map((conversation) => conversation.id === id ? update(conversation) : conversation));
  };

  const handleNewConversation = () => {
    if (isSending) return;
    const conversation: Conversation = { id: makeId(), title: 'New conversation', messages: [], updatedAt: Date.now() };
    setConversations((current) => [conversation, ...current].slice(0, 20));
    setActiveId(conversation.id);
    setError('');
    setRetryText('');
  };

  const handleDeleteConversation = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      if (id === activeId) setActiveId(next[0]?.id || '');
      return next;
    });
  };

  const handleSend = async (retry = false) => {
    const text = retry ? retryText : input.trim();
    if (!text || isSending || !configured) return;
    let conversation = conversations.find((item) => item.id === activeId);
    if (!conversation) {
      conversation = { id: makeId(), title: text.slice(0, 48), messages: [], updatedAt: Date.now() };
      setActiveId(conversation.id);
      setConversations((current) => [conversation!, ...current].slice(0, 20));
    }
    const conversationId = conversation.id;
    const userMessages = retry ? conversation.messages : [...conversation.messages, { role: 'user' as const, content: text }];
    const requestMessages = userMessages.slice(-20);
    setConversations((current) => current.map((item) => item.id === conversationId ? {
      ...item,
      title: item.messages.length === 0 && !retry ? text.slice(0, 48) : item.title,
      messages: [...userMessages, { role: 'assistant', content: '' }],
      updatedAt: Date.now(),
    } : item));
    setInput('');
    setError('');
    setRetryText('');
    setIsSending(true);
    let responseText = '';
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await api.streamChat(requestMessages, (chunk) => {
        responseText += chunk;
        updateConversation(conversationId, (item) => ({
          ...item,
          messages: item.messages.map((message, index) => index === item.messages.length - 1 ? { ...message, content: responseText } : message),
          updatedAt: Date.now(),
        }));
      }, controller.signal);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The assistant could not complete this response.');
      setRetryText(text);
      updateConversation(conversationId, (item) => ({ ...item, messages: item.messages.slice(0, -1) }));
    } finally {
      controllerRef.current = null;
      setIsSending(false);
    }
  };

  const handleCopy = async (message: ChatMessage, index: number) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(`${activeId}-${index}`);
      window.setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setError('The response could not be copied by this browser.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300"><Bot className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">StudyOS AI</span></div>
          <h1 className="mt-1 text-xl font-bold text-white">Study Assistant</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 text-xs ${configured ? 'text-emerald-300' : configured === false ? 'text-amber-300' : 'text-rose-300'}`}>
            <span className={`h-2 w-2 rounded-full ${configured ? 'bg-emerald-400' : configured === false ? 'bg-amber-400' : 'bg-rose-400'}`} />
            {configured ? 'Configured' : configured === false ? 'Not configured' : 'Service unavailable'}
          </span>
          <button type="button" onClick={onOpenSettings} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"><Settings2 className="h-4 w-4" /><span>AI Settings</span></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-800 py-3 md:border-b-0 md:border-r md:pr-3">
          <button type="button" onClick={handleNewConversation} disabled={isSending} className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"><MessageSquarePlus className="h-4 w-4" />New conversation</button>
          <div className="flex max-h-32 gap-2 overflow-auto md:max-h-[calc(100vh-15rem)] md:flex-col md:gap-1">
            {conversations.map((conversation) => <div key={conversation.id} className={`group flex min-w-0 items-center rounded-lg border ${conversation.id === activeId ? 'border-cyan-900 bg-cyan-950/30' : 'border-transparent hover:bg-slate-900'}`}>
              <button type="button" onClick={() => setActiveId(conversation.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs text-slate-300" title={conversation.title}>{conversation.title}</button>
              <button type="button" onClick={(event) => handleDeleteConversation(event, conversation.id)} disabled={isSending} className="px-2 py-2 text-slate-500 hover:text-rose-300 disabled:opacity-30" aria-label={`Delete ${conversation.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>)}
          </div>
        </aside>

        <section className="flex min-h-[55vh] min-w-0 flex-col md:pl-5" aria-label="AI conversation">
          <div className="flex-1 space-y-5 overflow-y-auto py-5" aria-live="polite">
            {!activeConversation?.messages.length && <div className="mx-auto max-w-lg py-14 text-center">
              <Bot className="mx-auto h-9 w-9 text-cyan-400" />
              <h2 className="mt-4 text-lg font-semibold text-white">What are you studying?</h2>
              <p className="mt-2 text-sm text-slate-400">Ask for an explanation, a worked example, or a study strategy. Add material in My Library to use the grounded study tools.</p>
            </div>}
            {activeConversation?.messages.map((message, index) => <article key={`${activeConversation.id}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-950 text-cyan-300"><Bot className="h-4 w-4" /></span>}
              <div className={`max-w-[90%] min-w-0 rounded-xl px-4 py-3 sm:max-w-[82%] ${message.role === 'user' ? 'bg-slate-800 text-slate-100' : 'border border-slate-800 bg-slate-900/70 text-slate-200'}`}>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content || (isSending && index === activeConversation.messages.length - 1 ? 'Thinking…' : '')}</p>
                {message.role === 'assistant' && message.content && <button type="button" onClick={() => handleCopy(message, index)} className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white" aria-label="Copy response">{copiedId === `${activeId}-${index}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === `${activeId}-${index}` ? 'Copied' : 'Copy'}</button>}
              </div>
              {message.role === 'user' && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400"><UserRound className="h-4 w-4" /></span>}
            </article>)}
            <div ref={bottomRef} />
          </div>

          {error && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2.5 text-xs text-rose-200">
            <span>{error}</span>{retryText && configured && <button type="button" onClick={() => void handleSend(true)} disabled={isSending} className="font-semibold underline underline-offset-2">Retry</button>}
          </div>}
          {configured === false && <div className="mb-3 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">Add a Google AI API key in AI Settings before sending a request.</div>}
          {configured === null && <div className="mb-3 rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2.5 text-xs text-rose-200">Could not reach the StudyOS backend. Check that the server is running.</div>}

          <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="border-t border-slate-800 pt-4">
            <label htmlFor="assistant-prompt" className="sr-only">Message the StudyOS assistant</label>
            <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2 focus-within:border-cyan-700">
              <textarea id="assistant-prompt" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); }
              }} disabled={isSending || !configured} rows={2} maxLength={4000} placeholder={configured ? 'Ask your study question…' : 'Configure AI to start a conversation'} className="max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50" />
              {isSending
                ? <button type="button" onClick={() => controllerRef.current?.abort()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-700 text-white hover:bg-rose-600" aria-label="Stop generation" title="Stop generation"><Square className="h-4 w-4 fill-current" /></button>
                : <button type="submit" disabled={!configured || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message" title="Send message"><Send className="h-4 w-4" /></button>}
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">Enter to send · Shift+Enter for a new line</p>
          </form>
        </section>
      </div>
    </div>
  );
};