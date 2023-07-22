use std::{fmt::Display, sync::Arc};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ClientId(Uuid);
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct RoomName(Arc<str>);
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct MonolithId(Uuid);

impl From<ClientId> for Uuid {
    fn from(val: ClientId) -> Self {
        val.0
    }
}

impl From<Uuid> for ClientId {
    fn from(val: Uuid) -> Self {
        Self(val)
    }
}

impl From<RoomName> for String {
    fn from(val: RoomName) -> Self {
        val.0.to_string()
    }
}

impl From<String> for RoomName {
    fn from(val: String) -> Self {
        Self(val.into())
    }
}

impl From<MonolithId> for Uuid {
    fn from(val: MonolithId) -> Self {
        val.0
    }
}

impl From<Uuid> for MonolithId {
    fn from(val: Uuid) -> Self {
        Self(val)
    }
}

impl Display for ClientId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl Display for RoomName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl Display for MonolithId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[derive(Debug, Clone)]
pub struct Context<Id, T>
where
    Id: std::hash::Hash,
{
    id: Id,
    message: T,
}

impl<Id, T> Context<Id, T>
where
    Id: std::hash::Hash,
{
    pub fn new(id: Id, message: T) -> Self {
        Self { id, message }
    }

    pub fn id(&self) -> &Id {
        &self.id
    }

    pub fn message(&self) -> &T {
        &self.message
    }
}
