# Secure Chat

Realtime 1-on-1 chat (Telegram-style) with end-to-end encryption. Supports text, emoji, images, videos and documents.

- **Backend:** Rust, Actix Web, WebSocket (`actix-ws`), PostgreSQL via `sqlx`
- **Frontend:** React 19 + TypeScript + Vite, WebCrypto for all cryptography

## Running it

Requirements: Rust (stable), Node 20+, Docker (or any PostgreSQL 14+).

```bash
docker compose up -d                      # PostgreSQL

cd backend
cp .env.example .env                      # set JWT_SECRET to a long random value
cargo run                                 # runs migrations on start, listens on :8080

cd ../frontend
npm install
npm run dev                               # http://localhost:5173, proxies /api and /ws to :8080
```

Open the app in two different browser profiles, register two users and start chatting.

Tests: `cargo test` in `backend/`, `npm test` in `frontend/`.

## Architecture

### Backend (`backend/src`)

Dependencies point inward only: `presentation → application → domain`; `infrastructure` implements the ports declared by `application`.

| Layer | Responsibility |
| --- | --- |
| `domain` | Entities and validation (`User`, `Message`, `Attachment`), domain errors. No framework code. |
| `application` | Use cases (`AuthService`, `MessageService`, `AttachmentService`, `UserService`) and the ports they depend on (`ports.rs`). Tested with in-memory fakes. |
| `infrastructure` | Postgres repositories, local file storage, Argon2 hasher, JWT, in-process WebSocket connection hub. |
| `presentation` | Actix HTTP handlers, DTOs, WebSocket session, error mapping. |
| `bootstrap.rs` | The only place where concrete types are wired together. |

`sqlx` is used instead of a full ORM: the schema is small and explicit SQL keeps the queries easy to read.

### Frontend (`frontend/src`)

- `crypto/` – key generation, message and file encryption, safety numbers. Plain functions over WebCrypto, no React.
- `features/auth`, `features/chat` – each split into API calls (`*Api.ts`), use-case logic (`*Service.ts`), state (`*Context`, `chatReducer`) and components.
- `shared/` – HTTP client, encoding helpers, small UI primitives.

## Encryption model

1. **Identity key.** On registration the browser generates an ECDH P-256 key pair and uploads the public key.
2. **Password handling.** PBKDF2-SHA-256 (600k iterations) turns the password into 512 bits. The first half is the *auth secret* sent to the server, which stores only an Argon2id hash of it. The second half is a *wrapping key* that never leaves the browser and encrypts the private key with AES-GCM. The server keeps the wrapped private key so a new device can restore the identity after login, but it cannot decrypt it.
3. **Messages.** Both sides of a conversation derive the same AES-256-GCM key from ECDH + HKDF. Sender and recipient ids are bound as additional authenticated data, so a ciphertext cannot be replayed in another conversation or reflected back.
4. **Files.** Each file gets a random AES-256-GCM key and is encrypted in the browser before upload. The key and IV travel inside the encrypted message, so the server stores only an opaque blob.
5. **Safety number.** Users can compare a fingerprint of both public keys out of band to detect a server that swaps keys.

The server sees who talks to whom, when, and the sizes of messages and files. It never sees content, file names, MIME types or captions.

## Limitations

- Only 1-on-1 chats. Telegram's default chats are not E2E at all (only "secret chats" are); here every chat is.
- No forward secrecy or double ratchet: the conversation key is static per pair of users, so a leaked private key exposes that user's history. X3DH + Double Ratchet is the natural next step.
- Forgetting the password means losing message history. There is no recovery by design.
- First contact trusts the server to hand out the right public key until users compare safety numbers.
- Uploads go to local disk (`UPLOAD_DIR`); implement the storage port for S3 to change that.
- The WebSocket hub is in-process, so run a single backend instance, or put a broker (Redis pub/sub, NATS) behind `ConnectionHub` before scaling out.
