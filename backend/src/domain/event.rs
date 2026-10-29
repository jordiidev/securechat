use super::message::Message;

/// Something that happened which connected clients should hear about.
#[derive(Debug, Clone)]
pub enum DomainEvent {
    MessageReceived(Message),
}
