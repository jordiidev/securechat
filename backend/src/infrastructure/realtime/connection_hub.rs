use std::collections::HashMap;

use async_trait::async_trait;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::application::ports::EventPublisher;
use crate::domain::event::DomainEvent;
use crate::domain::user::UserId;

type ConnectionId = Uuid;

/// One live WebSocket of a user. Hold on to it to receive events and to unsubscribe later.
pub struct Subscription {
    user_id: UserId,
    connection_id: ConnectionId,
    pub events: mpsc::UnboundedReceiver<DomainEvent>,
}

/// In-memory registry of the open connections of every user.
/// A user may be connected from several devices at once.
#[derive(Default)]
pub struct ConnectionHub {
    connections: RwLock<HashMap<UserId, HashMap<ConnectionId, mpsc::UnboundedSender<DomainEvent>>>>,
}

impl ConnectionHub {
    pub async fn subscribe(&self, user_id: UserId) -> Subscription {
        let (sender, events) = mpsc::unbounded_channel();
        let connection_id = Uuid::new_v4();
        self.connections
            .write()
            .await
            .entry(user_id)
            .or_default()
            .insert(connection_id, sender);

        Subscription {
            user_id,
            connection_id,
            events,
        }
    }

    pub async fn unsubscribe(&self, subscription: &Subscription) {
        let mut connections = self.connections.write().await;
        if let Some(user_connections) = connections.get_mut(&subscription.user_id) {
            user_connections.remove(&subscription.connection_id);
            if user_connections.is_empty() {
                connections.remove(&subscription.user_id);
            }
        }
    }
}

#[async_trait]
impl EventPublisher for ConnectionHub {
    async fn publish(&self, to: UserId, event: DomainEvent) {
        let connections = self.connections.read().await;
        if let Some(user_connections) = connections.get(&to) {
            for sender in user_connections.values() {
                // A closed receiver only means that socket is going away; it unsubscribes itself.
                let _ = sender.send(event.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::message::Message;
    use chrono::Utc;

    fn sample_event() -> DomainEvent {
        DomainEvent::MessageReceived(Message {
            id: Uuid::new_v4(),
            sender_id: Uuid::new_v4(),
            recipient_id: Uuid::new_v4(),
            ciphertext: "ct".into(),
            iv: "iv".into(),
            created_at: Utc::now(),
        })
    }

    #[tokio::test]
    async fn event_reaches_every_device_of_the_user() {
        let hub = ConnectionHub::default();
        let user = Uuid::new_v4();
        let mut phone = hub.subscribe(user).await;
        let mut laptop = hub.subscribe(user).await;

        hub.publish(user, sample_event()).await;

        assert!(phone.events.recv().await.is_some());
        assert!(laptop.events.recv().await.is_some());
    }

    #[tokio::test]
    async fn event_does_not_reach_other_users() {
        let hub = ConnectionHub::default();
        let mut stranger = hub.subscribe(Uuid::new_v4()).await;

        hub.publish(Uuid::new_v4(), sample_event()).await;

        assert!(stranger.events.try_recv().is_err());
    }

    #[tokio::test]
    async fn unsubscribed_connection_is_forgotten() {
        let hub = ConnectionHub::default();
        let user = Uuid::new_v4();
        let subscription = hub.subscribe(user).await;

        hub.unsubscribe(&subscription).await;

        assert!(hub.connections.read().await.is_empty());
    }
}
