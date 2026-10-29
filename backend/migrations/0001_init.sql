CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username              TEXT        NOT NULL UNIQUE,
    password_hash         TEXT        NOT NULL,
    kdf_salt              TEXT        NOT NULL,
    public_key            TEXT        NOT NULL,
    encrypted_private_key TEXT        NOT NULL,
    private_key_iv        TEXT        NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,32}$')
);

CREATE TABLE messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    recipient_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    ciphertext   TEXT        NOT NULL,
    iv           TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_not_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX messages_sender_recipient_idx ON messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX messages_recipient_sender_idx ON messages (recipient_id, sender_id, created_at DESC);

CREATE TABLE attachments (
    id           UUID PRIMARY KEY,
    uploader_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    recipient_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    size_bytes   BIGINT      NOT NULL CHECK (size_bytes > 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
