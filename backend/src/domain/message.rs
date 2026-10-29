use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::encoding::require_decoded_len;
use super::error::DomainError;
use super::user::UserId;

pub type MessageId = Uuid;

const AES_GCM_IV_BYTES: usize = 12;
const MAX_CIPHERTEXT_CHARS: usize = 100_000;

/// A message as the server sees it: opaque ciphertext plus routing metadata.
#[derive(Debug, Clone)]
pub struct Message {
    pub id: MessageId,
    pub sender_id: UserId,
    pub recipient_id: UserId,
    pub ciphertext: String,
    pub iv: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewMessage {
    pub sender_id: UserId,
    pub recipient_id: UserId,
    pub ciphertext: String,
    pub iv: String,
}

impl NewMessage {
    pub fn new(
        sender_id: UserId,
        recipient_id: UserId,
        ciphertext: String,
        iv: String,
    ) -> Result<Self, DomainError> {
        if sender_id == recipient_id {
            return Err(DomainError::invalid("cannot send a message to yourself"));
        }
        if ciphertext.is_empty() || ciphertext.len() > MAX_CIPHERTEXT_CHARS {
            return Err(DomainError::invalid("ciphertext has an invalid size"));
        }
        require_decoded_len("iv", &iv, AES_GCM_IV_BYTES)?;
        Ok(Self {
            sender_id,
            recipient_id,
            ciphertext,
            iv,
        })
    }
}

#[async_trait]
pub trait MessageRepository: Send + Sync {
    async fn create(&self, new_message: NewMessage) -> Result<Message, DomainError>;

    /// Messages exchanged between two users, newest first.
    async fn history(
        &self,
        user: UserId,
        peer: UserId,
        before: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<Message>, DomainError>;

    /// The most recent message of every conversation the user takes part in.
    async fn latest_per_conversation(&self, user: UserId) -> Result<Vec<Message>, DomainError>;
}
