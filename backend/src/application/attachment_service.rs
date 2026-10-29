use std::sync::Arc;

use uuid::Uuid;

use crate::domain::attachment::{Attachment, AttachmentId, AttachmentRepository, NewAttachment};
use crate::domain::error::DomainError;
use crate::domain::user::{UserId, UserRepository};

use super::ports::FileStorage;

pub struct AttachmentService {
    users: Arc<dyn UserRepository>,
    attachments: Arc<dyn AttachmentRepository>,
    storage: Arc<dyn FileStorage>,
    max_bytes: usize,
}

impl AttachmentService {
    pub fn new(
        users: Arc<dyn UserRepository>,
        attachments: Arc<dyn AttachmentRepository>,
        storage: Arc<dyn FileStorage>,
        max_bytes: usize,
    ) -> Self {
        Self {
            users,
            attachments,
            storage,
            max_bytes,
        }
    }

    /// Stores an already-encrypted blob that the uploader intends to share with `recipient_id`.
    pub async fn upload(
        &self,
        uploader_id: UserId,
        recipient_id: UserId,
        encrypted_bytes: &[u8],
    ) -> Result<Attachment, DomainError> {
        if encrypted_bytes.is_empty() {
            return Err(DomainError::invalid("file is empty"));
        }
        if encrypted_bytes.len() > self.max_bytes {
            return Err(DomainError::PayloadTooLarge);
        }
        if uploader_id == recipient_id {
            return Err(DomainError::invalid("cannot send a file to yourself"));
        }
        self.users
            .find_by_id(recipient_id)
            .await?
            .ok_or(DomainError::NotFound("recipient"))?;

        let id = Uuid::new_v4();
        self.storage.save(id, encrypted_bytes).await?;
        self.attachments
            .create(NewAttachment {
                id,
                uploader_id,
                recipient_id,
                size_bytes: encrypted_bytes.len() as i64,
            })
            .await
    }

    pub async fn download(
        &self,
        requester: UserId,
        id: AttachmentId,
    ) -> Result<Vec<u8>, DomainError> {
        let attachment = self
            .attachments
            .find_by_id(id)
            .await?
            .ok_or(DomainError::NotFound("attachment"))?;

        if !attachment.can_be_read_by(requester) {
            return Err(DomainError::Forbidden);
        }
        self.storage.load(id).await
    }
}
