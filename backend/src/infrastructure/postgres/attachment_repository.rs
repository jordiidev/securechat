use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::domain::attachment::{Attachment, AttachmentId, AttachmentRepository, NewAttachment};
use crate::domain::error::DomainError;

use super::internal;

const COLUMNS: &str = "id, uploader_id, recipient_id, size_bytes, created_at";

#[derive(FromRow)]
struct AttachmentRow {
    id: Uuid,
    uploader_id: Uuid,
    recipient_id: Uuid,
    size_bytes: i64,
    created_at: DateTime<Utc>,
}

impl From<AttachmentRow> for Attachment {
    fn from(row: AttachmentRow) -> Self {
        Attachment {
            id: row.id,
            uploader_id: row.uploader_id,
            recipient_id: row.recipient_id,
            size_bytes: row.size_bytes,
            created_at: row.created_at,
        }
    }
}

pub struct PgAttachmentRepository {
    pool: PgPool,
}

impl PgAttachmentRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AttachmentRepository for PgAttachmentRepository {
    async fn create(&self, new_attachment: NewAttachment) -> Result<Attachment, DomainError> {
        let query = format!(
            "INSERT INTO attachments (id, uploader_id, recipient_id, size_bytes) \
             VALUES ($1, $2, $3, $4) RETURNING {COLUMNS}"
        );
        sqlx::query_as::<_, AttachmentRow>(&query)
            .bind(new_attachment.id)
            .bind(new_attachment.uploader_id)
            .bind(new_attachment.recipient_id)
            .bind(new_attachment.size_bytes)
            .fetch_one(&self.pool)
            .await
            .map(Attachment::from)
            .map_err(internal)
    }

    async fn find_by_id(&self, id: AttachmentId) -> Result<Option<Attachment>, DomainError> {
        let query = format!("SELECT {COLUMNS} FROM attachments WHERE id = $1");
        sqlx::query_as::<_, AttachmentRow>(&query)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map(|row| row.map(Attachment::from))
            .map_err(internal)
    }
}
