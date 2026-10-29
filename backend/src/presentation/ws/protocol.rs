use serde::{Deserialize, Serialize};

use crate::domain::event::DomainEvent;
use crate::presentation::http::MessageDto;

/// Frames the client may send.
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientFrame {
    Auth { token: String },
}

/// Frames the server pushes.
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerFrame {
    Ready,
    Message { message: MessageDto },
}

impl From<&DomainEvent> for ServerFrame {
    fn from(event: &DomainEvent) -> Self {
        match event {
            DomainEvent::MessageReceived(message) => ServerFrame::Message {
                message: MessageDto::from(message),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_frame_is_parsed() {
        let frame: ClientFrame = serde_json::from_str(r#"{"type":"auth","token":"abc"}"#).unwrap();
        let ClientFrame::Auth { token } = frame;
        assert_eq!(token, "abc");
    }

    #[test]
    fn ready_frame_is_tagged() {
        let json = serde_json::to_string(&ServerFrame::Ready).unwrap();
        assert_eq!(json, r#"{"type":"ready"}"#);
    }
}
