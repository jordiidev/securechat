import { formatTime } from '../../../shared/format';
import type { ChatMessage } from '../types';
import { AttachmentView } from './AttachmentView';

export function MessageBubble({ message, own }: { message: ChatMessage; own: boolean }) {
  const { payload } = message;

  return (
    <div className={`bubble-row${own ? ' bubble-row--own' : ''}`}>
      <div className={`bubble${own ? ' bubble--own' : ''}`}>
        {payload === null && (
          <p className="bubble__text bubble__text--error">🔒 This message could not be decrypted.</p>
        )}
        {payload?.kind === 'text' && <p className="bubble__text">{payload.text}</p>}
        {payload?.kind === 'file' && (
          <>
            <AttachmentView file={payload.file} />
            {payload.caption && <p className="bubble__text">{payload.caption}</p>}
          </>
        )}
        <time className="bubble__time" dateTime={message.createdAt}>
          {formatTime(message.createdAt)}
        </time>
      </div>
    </div>
  );
}
