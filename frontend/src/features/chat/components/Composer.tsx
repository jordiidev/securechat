import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

import { formatBytes } from '../../../shared/format';
import { CloseIcon, FileIcon, PaperclipIcon, SendIcon, SmileIcon } from '../../../shared/icons';
import { MAX_FILE_BYTES } from '../chatService';

// The emoji dataset is large, so it is only downloaded when the picker is first opened.
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const MAX_TEXT_LENGTH = 4096;
const MAX_TEXTAREA_HEIGHT_PX = 160;

interface ComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendFile: (file: File, caption: string) => Promise<void>;
}

export function Composer({ onSendText, onSendFile }: ComposerProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerAreaRef = useRef<HTMLDivElement>(null);

  const canSend = !sending && (file !== null || text.trim().length > 0);

  useEffect(() => {
    if (!pickerOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerAreaRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpen]);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }

  function insertAtCaret(insertion: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + insertion + text.slice(end);
    if (next.length > MAX_TEXT_LENGTH) return;

    setText(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + insertion.length, start + insertion.length);
      resizeTextarea();
    });
  }

  function attach(candidate: File | undefined) {
    if (!candidate) return;
    if (candidate.size > MAX_FILE_BYTES) {
      setError(`That file is too large. The limit is ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    if (candidate.size === 0) {
      setError('That file is empty.');
      return;
    }
    setError(null);
    setFile(candidate);
    textareaRef.current?.focus();
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    attach(event.target.files?.[0]);
    event.target.value = '';
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.files[0];
    if (pasted) {
      event.preventDefault();
      attach(pasted);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  async function submit() {
    if (!canSend) return;

    setSending(true);
    setError(null);
    try {
      if (file) await onSendFile(file, text.trim());
      else await onSendText(text.trim());

      setText('');
      setFile(null);
      setPickerOpen(false);
      requestAnimationFrame(resizeTextarea);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the message.');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="composer" ref={pickerAreaRef}>
      {pickerOpen && (
        <div className="composer__picker">
          <Suspense fallback={<div className="composer__picker-loading">Loading emoji…</div>}>
            <EmojiPicker
              onEmojiClick={(emoji) => insertAtCaret(emoji.emoji)}
              theme="auto"
              width="100%"
              height={340}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
            />
          </Suspense>
        </div>
      )}

      {file && (
        <div className="composer__attachment">
          <FileIcon />
          <span className="composer__attachment-name">{file.name}</span>
          <span className="composer__attachment-size">{formatBytes(file.size)}</span>
          <button
            className="icon-button icon-button--small"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            disabled={sending}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      )}
      {error && (
        <p className="composer__error" role="alert">
          {error}
        </p>
      )}

      <div className="composer__row">
        <button
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
          disabled={sending}
        >
          <PaperclipIcon />
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileInput} />

        <textarea
          ref={textareaRef}
          className="composer__input"
          rows={1}
          maxLength={MAX_TEXT_LENGTH}
          placeholder={file ? 'Add a caption…' : 'Write a message…'}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-label="Message"
        />

        <button
          className="icon-button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label="Emoji"
          aria-expanded={pickerOpen}
          title="Emoji"
        >
          <SmileIcon />
        </button>
        <button
          className="icon-button icon-button--accent"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send"
          title="Send"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
