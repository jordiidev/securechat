use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::auth_service::{AuthSession, RegisterInput};
use crate::application::message_service::ConversationSummary;
use crate::domain::message::Message;
use crate::domain::user::{KeyBundle, User};

#[derive(Deserialize)]
pub struct PreloginRequest {
    pub username: String,
}

#[derive(Serialize)]
pub struct PreloginResponse {
    pub kdf_salt: String,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub auth_secret: String,
    pub kdf_salt: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub private_key_iv: String,
}

impl From<RegisterRequest> for RegisterInput {
    fn from(request: RegisterRequest) -> Self {
        Self {
            username: request.username,
            auth_secret: request.auth_secret,
            kdf_salt: request.kdf_salt,
            public_key: request.public_key,
            encrypted_private_key: request.encrypted_private_key,
            private_key_iv: request.private_key_iv,
        }
    }
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub auth_secret: String,
}

#[derive(Serialize)]
pub struct UserDto {
    pub id: Uuid,
    pub username: String,
    pub public_key: String,
    pub created_at: DateTime<Utc>,
}

impl From<&User> for UserDto {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            username: user.username.as_str().to_owned(),
            public_key: user.keys.public_key.clone(),
            created_at: user.created_at,
        }
    }
}

#[derive(Serialize)]
pub struct KeyBundleDto {
    pub kdf_salt: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub private_key_iv: String,
}

impl From<&KeyBundle> for KeyBundleDto {
    fn from(keys: &KeyBundle) -> Self {
        Self {
            kdf_salt: keys.kdf_salt.clone(),
            public_key: keys.public_key.clone(),
            encrypted_private_key: keys.encrypted_private_key.clone(),
            private_key_iv: keys.private_key_iv.clone(),
        }
    }
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserDto,
    pub keys: KeyBundleDto,
}

impl From<AuthSession> for AuthResponse {
    fn from(session: AuthSession) -> Self {
        Self {
            user: UserDto::from(&session.user),
            keys: KeyBundleDto::from(&session.user.keys),
            token: session.token,
        }
    }
}

#[derive(Deserialize)]
pub struct SearchUsersQuery {
    #[serde(default)]
    pub q: String,
}

#[derive(Serialize)]
pub struct MessageDto {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub recipient_id: Uuid,
    pub ciphertext: String,
    pub iv: String,
    pub created_at: DateTime<Utc>,
}

impl From<&Message> for MessageDto {
    fn from(message: &Message) -> Self {
        Self {
            id: message.id,
            sender_id: message.sender_id,
            recipient_id: message.recipient_id,
            ciphertext: message.ciphertext.clone(),
            iv: message.iv.clone(),
            created_at: message.created_at,
        }
    }
}

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub recipient_id: Uuid,
    pub ciphertext: String,
    pub iv: String,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub peer_id: Uuid,
    pub before: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct ConversationDto {
    pub peer: UserDto,
    pub last_message: MessageDto,
}

impl From<&ConversationSummary> for ConversationDto {
    fn from(summary: &ConversationSummary) -> Self {
        Self {
            peer: UserDto::from(&summary.peer),
            last_message: MessageDto::from(&summary.last_message),
        }
    }
}

#[derive(Deserialize)]
pub struct UploadQuery {
    pub recipient_id: Uuid,
}

#[derive(Serialize)]
pub struct AttachmentDto {
    pub id: Uuid,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}
