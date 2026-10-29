use std::io::ErrorKind;
use std::path::PathBuf;

use async_trait::async_trait;
use tokio::fs;

use crate::application::ports::FileStorage;
use crate::domain::attachment::AttachmentId;
use crate::domain::error::DomainError;

/// Stores blobs as `<root>/<uuid>`. File names come from UUIDs only, so a path can never escape `root`.
pub struct LocalFileStorage {
    root: PathBuf,
}

impl LocalFileStorage {
    pub async fn new(root: PathBuf) -> std::io::Result<Self> {
        fs::create_dir_all(&root).await?;
        Ok(Self { root })
    }

    fn path_of(&self, id: AttachmentId) -> PathBuf {
        self.root.join(id.to_string())
    }
}

#[async_trait]
impl FileStorage for LocalFileStorage {
    async fn save(&self, id: AttachmentId, bytes: &[u8]) -> Result<(), DomainError> {
        fs::write(self.path_of(id), bytes)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))
    }

    async fn load(&self, id: AttachmentId) -> Result<Vec<u8>, DomainError> {
        fs::read(self.path_of(id))
            .await
            .map_err(|error| match error.kind() {
                ErrorKind::NotFound => DomainError::NotFound("attachment"),
                _ => DomainError::Internal(error.to_string()),
            })
    }
}
