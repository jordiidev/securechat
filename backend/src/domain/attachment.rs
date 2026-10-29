use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::DomainError;
use super::user::UserId;

pub type AttachmentId = Uuid;

/// Metadata of an encrypted file blob. The server never sees names, types or keys.
#[derive(Debug, Clone)]
pub struct Attachment {
    pub id: AttachmentId,
    pub uploader_id: UserId,
    pub recipient_id: UserId,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

impl Attachment {
    pub fn can_be_read_by(&self, user: UserId) -> bool {
        user == self.uploader_id || user == self.recipient_id
    }
}

#[derive(Debug, Clone)]
pub struct NewAttachment {
    pub id: AttachmentId,
    pub uploader_id: UserId,
    pub recipient_id: UserId,
    pub size_bytes: i64,
}

#[async_trait]
pub trait AttachmentRepository: Send + Sync {
    async fn create(&self, new_attachment: NewAttachment) -> Result<Attachment, DomainError>;
    async fn find_by_id(&self, id: AttachmentId) -> Result<Option<Attachment>, DomainError>;
}
