use std::sync::Arc;

use crate::domain::error::DomainError;
use crate::domain::user::{User, UserId, UserRepository};

const SEARCH_LIMIT: i64 = 20;

pub struct UserService {
    users: Arc<dyn UserRepository>,
}

impl UserService {
    pub fn new(users: Arc<dyn UserRepository>) -> Self {
        Self { users }
    }

    pub async fn get(&self, id: UserId) -> Result<User, DomainError> {
        self.users
            .find_by_id(id)
            .await?
            .ok_or(DomainError::NotFound("user"))
    }

    pub async fn search(&self, requester: UserId, query: &str) -> Result<Vec<User>, DomainError> {
        let prefix = query.trim().to_lowercase();
        if prefix.is_empty() {
            return Ok(Vec::new());
        }
        self.users
            .search_by_username_prefix(&prefix, requester, SEARCH_LIMIT)
            .await
    }
}
