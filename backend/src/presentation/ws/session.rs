use std::sync::Arc;
use std::time::Duration;

use actix_ws::{CloseCode, Message, MessageStream, Session};
use futures_util::StreamExt;
use tokio::time::{interval, timeout};

use crate::application::ports::TokenService;
use crate::domain::user::UserId;
use crate::infrastructure::realtime::ConnectionHub;

use super::protocol::{ClientFrame, ServerFrame};

const AUTH_TIMEOUT: Duration = Duration::from_secs(5);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(25);

pub async fn run(
    mut session: Session,
    mut stream: MessageStream,
    tokens: Arc<dyn TokenService>,
    hub: Arc<ConnectionHub>,
) {
    let Some(user_id) = authenticate(&mut stream, tokens.as_ref()).await else {
        let _ = session.close(Some(CloseCode::Policy.into())).await;
        return;
    };

    let mut subscription = hub.subscribe(user_id).await;
    if send_frame(&mut session, &ServerFrame::Ready).await.is_ok() {
        let mut heartbeat = interval(HEARTBEAT_INTERVAL);

        loop {
            tokio::select! {
                Some(event) = subscription.events.recv() => {
                    if send_frame(&mut session, &ServerFrame::from(&event)).await.is_err() {
                        break;
                    }
                }
                _ = heartbeat.tick() => {
                    if session.ping(b"").await.is_err() {
                        break;
                    }
                }
                incoming = stream.next() => match incoming {
                    Some(Ok(Message::Ping(bytes))) => {
                        if session.pong(&bytes).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(reason))) => {
                        let _ = session.close(reason).await;
                        break;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) | None => break,
                },
            }
        }
    }

    hub.unsubscribe(&subscription).await;
}

/// Waits for the `auth` frame and resolves it to a user.
async fn authenticate(stream: &mut MessageStream, tokens: &dyn TokenService) -> Option<UserId> {
    let first_text_frame = async {
        while let Some(Ok(message)) = stream.next().await {
            if let Message::Text(text) = message {
                return Some(text);
            }
        }
        None
    };

    let text = timeout(AUTH_TIMEOUT, first_text_frame).await.ok()??;
    let ClientFrame::Auth { token } = serde_json::from_str(&text).ok()?;
    tokens.verify(&token).ok()
}

async fn send_frame(session: &mut Session, frame: &ServerFrame) -> Result<(), actix_ws::Closed> {
    match serde_json::to_string(frame) {
        Ok(json) => session.text(json).await,
        Err(error) => {
            tracing::error!(%error, "failed to serialise websocket frame");
            Ok(())
        }
    }
}
