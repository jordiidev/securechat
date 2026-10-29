use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::user::{KeyBundle, NewUser, User, UserId, UserRepository, Username};

use super::internal;

const COLUMNS: &str = "id, username, password_hash, kdf_salt, public_key, \
                       encrypted_private_key, private_key_iv, created_at";

#[derive(FromRow)]
struct UserRow {
    id: Uuid,
    username: String,
    password_hash: String,
    kdf_salt: String,
    public_key: String,
    encrypted_private_key: String,
    private_key_iv: String,
    created_at: DateTime<Utc>,
}

impl TryFrom<UserRow> for User {
    type Error = DomainError;

    fn try_from(row: UserRow) -> Result<Self, Self::Error> {
        Ok(User {
            id: row.id,
            username: Username::parse(&row.username)?,
            password_hash: row.password_hash,
            keys: KeyBundle {
                kdf_salt: row.kdf_salt,
                public_key: row.public_key,
                encrypted_private_key: row.encrypted_private_key,
                private_key_iv: row.private_key_iv,
            },
            created_at: row.created_at,
        })
    }
}

pub struct PgUserRepository {
    pool: PgPool,
}

impl PgUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PgUserRepository {
    async fn create(&self, new_user: NewUser) -> Result<User, DomainError> {
        let query = format!(
            "INSERT INTO users (username, password_hash, kdf_salt, public_key, \
             encrypted_private_key, private_key_iv) \
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING {COLUMNS}"
        );
        let row = sqlx::query_as::<_, UserRow>(&query)
            .bind(new_user.username.as_str())
            .bind(&new_user.password_hash)
            .bind(&new_user.keys.kdf_salt)
            .bind(&new_user.keys.public_key)
            .bind(&new_user.keys.encrypted_private_key)
            .bind(&new_user.keys.private_key_iv)
            .fetch_one(&self.pool)
            .await
            .map_err(|error| match &error {
                sqlx::Error::Database(db) if db.is_unique_violation() => DomainError::UsernameTaken,
                _ => internal(error),
            })?;
        row.try_into()
    }

    async fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError> {
        let query = format!("SELECT {COLUMNS} FROM users WHERE id = $1");
        sqlx::query_as::<_, UserRow>(&query)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(internal)?
            .map(User::try_from)
            .transpose()
    }

    async fn find_by_username(&self, username: &Username) -> Result<Option<User>, DomainError> {
        let query = format!("SELECT {COLUMNS} FROM users WHERE username = $1");
        sqlx::query_as::<_, UserRow>(&query)
            .bind(username.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(internal)?
            .map(User::try_from)
            .transpose()
    }

    async fn find_many(&self, ids: &[UserId]) -> Result<Vec<User>, DomainError> {
        let query = format!("SELECT {COLUMNS} FROM users WHERE id = ANY($1)");
        sqlx::query_as::<_, UserRow>(&query)
            .bind(ids)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?
            .into_iter()
            .map(User::try_from)
            .collect()
    }

    async fn search_by_username_prefix(
        &self,
        prefix: &str,
        exclude: UserId,
        limit: i64,
    ) -> Result<Vec<User>, DomainError> {
        // starts_with() avoids LIKE wildcards, and '_' is a valid username character.
        let query = format!(
            "SELECT {COLUMNS} FROM users \
             WHERE starts_with(username, $1) AND id <> $2 \
             ORDER BY username LIMIT $3"
        );
        sqlx::query_as::<_, UserRow>(&query)
            .bind(prefix)
            .bind(exclude)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?
            .into_iter()
            .map(User::try_from)
            .collect()
    }
}
