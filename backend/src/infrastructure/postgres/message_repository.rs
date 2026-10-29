use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::message::{Message, MessageRepository, NewMessage};
use crate::domain::user::UserId;

use super::internal;

const COLUMNS: &str = "id, sender_id, recipient_id, ciphertext, iv, created_at";

#[derive(FromRow)]
struct MessageRow {
    id: Uuid,
    sender_id: Uuid,
    recipient_id: Uuid,
    ciphertext: String,
    iv: String,
    created_at: DateTime<Utc>,
}

impl From<MessageRow> for Message {
    fn from(row: MessageRow) -> Self {
        Message {
            id: row.id,
            sender_id: row.sender_id,
            recipient_id: row.recipient_id,
            ciphertext: row.ciphertext,
            iv: row.iv,
            created_at: row.created_at,
        }
    }
}

pub struct PgMessageRepository {
    pool: PgPool,
}

impl PgMessageRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MessageRepository for PgMessageRepository {
    async fn create(&self, new_message: NewMessage) -> Result<Message, DomainError> {
        let query = format!(
            "INSERT INTO messages (sender_id, recipient_id, ciphertext, iv) \
             VALUES ($1, $2, $3, $4) RETURNING {COLUMNS}"
        );
        sqlx::query_as::<_, MessageRow>(&query)
            .bind(new_message.sender_id)
            .bind(new_message.recipient_id)
            .bind(&new_message.ciphertext)
            .bind(&new_message.iv)
            .fetch_one(&self.pool)
            .await
            .map(Message::from)
            .map_err(internal)
    }

    async fn history(
        &self,
        user: UserId,
        peer: UserId,
        before: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<Message>, DomainError> {
        let query = format!(
            "SELECT {COLUMNS} FROM messages \
             WHERE ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)) \
               AND ($3::timestamptz IS NULL OR created_at < $3) \
             ORDER BY created_at DESC LIMIT $4"
        );
        let rows = sqlx::query_as::<_, MessageRow>(&query)
            .bind(user)
            .bind(peer)
            .bind(before)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;
        Ok(rows.into_iter().map(Message::from).collect())
    }

    async fn latest_per_conversation(&self, user: UserId) -> Result<Vec<Message>, DomainError> {
        let query = format!(
            "SELECT DISTINCT ON (peer_id) {COLUMNS} FROM ( \
                 SELECT *, CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id \
                 FROM messages WHERE sender_id = $1 OR recipient_id = $1 \
             ) conversation \
             ORDER BY peer_id, created_at DESC"
        );
        let rows = sqlx::query_as::<_, MessageRow>(&query)
            .bind(user)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;
        Ok(rows.into_iter().map(Message::from).collect())
    }
}
