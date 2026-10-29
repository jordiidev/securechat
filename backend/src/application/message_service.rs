use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};

use crate::domain::error::DomainError;
use crate::domain::event::DomainEvent;
use crate::domain::message::{Message, MessageRepository, NewMessage};
use crate::domain::user::{User, UserId, UserRepository};

use super::ports::EventPublisher;

const DEFAULT_HISTORY_LIMIT: i64 = 50;
const MAX_HISTORY_LIMIT: i64 = 100;

pub struct ConversationSummary {
    pub peer: User,
    pub last_message: Message,
}

pub struct MessageService {
    users: Arc<dyn UserRepository>,
    messages: Arc<dyn MessageRepository>,
    events: Arc<dyn EventPublisher>,
}

impl MessageService {
    pub fn new(
        users: Arc<dyn UserRepository>,
        messages: Arc<dyn MessageRepository>,
        events: Arc<dyn EventPublisher>,
    ) -> Self {
        Self {
            users,
            messages,
            events,
        }
    }

    pub async fn send(
        &self,
        sender_id: UserId,
        recipient_id: UserId,
        ciphertext: String,
        iv: String,
    ) -> Result<Message, DomainError> {
        let new_message = NewMessage::new(sender_id, recipient_id, ciphertext, iv)?;
        self.users
            .find_by_id(recipient_id)
            .await?
            .ok_or(DomainError::NotFound("recipient"))?;

        let message = self.messages.create(new_message).await?;

        // The sender's other devices need the message too, not only the recipient.
        for audience in [recipient_id, sender_id] {
            self.events
                .publish(audience, DomainEvent::MessageReceived(message.clone()))
                .await;
        }
        Ok(message)
    }

    /// Returns up to `limit` messages older than `before`, oldest first.
    pub async fn history(
        &self,
        user: UserId,
        peer: UserId,
        before: Option<DateTime<Utc>>,
        limit: Option<i64>,
    ) -> Result<Vec<Message>, DomainError> {
        let limit = limit
            .unwrap_or(DEFAULT_HISTORY_LIMIT)
            .clamp(1, MAX_HISTORY_LIMIT);
        let mut page = self.messages.history(user, peer, before, limit).await?;
        page.reverse();
        Ok(page)
    }

    pub async fn conversations(
        &self,
        user: UserId,
    ) -> Result<Vec<ConversationSummary>, DomainError> {
        let mut latest = self.messages.latest_per_conversation(user).await?;
        latest.sort_by_key(|message| std::cmp::Reverse(message.created_at));

        let peer_ids: Vec<UserId> = latest
            .iter()
            .map(|message| peer_of(message, user))
            .collect();
        let mut peers: HashMap<UserId, User> = self
            .users
            .find_many(&peer_ids)
            .await?
            .into_iter()
            .map(|peer| (peer.id, peer))
            .collect();

        Ok(latest
            .into_iter()
            .filter_map(|last_message| {
                peers
                    .remove(&peer_of(&last_message, user))
                    .map(|peer| ConversationSummary { peer, last_message })
            })
            .collect())
    }
}

fn peer_of(message: &Message, user: UserId) -> UserId {
    if message.sender_id == user {
        message.recipient_id
    } else {
        message.sender_id
    }
}
