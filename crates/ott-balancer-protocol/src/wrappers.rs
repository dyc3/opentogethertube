use std::{fmt::Display, hash::Hash, sync::Arc};

use serde::{Deserialize, Serialize};
use typeshare::typeshare;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[typeshare(serialized_as = "String")]
pub struct ClientId(Uuid);
#[derive(Debug, Clone, Eq, Ord, Serialize, Deserialize)]
#[typeshare(serialized_as = "String")]
pub struct RoomName(Arc<str>);
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[typeshare(serialized_as = "String")]
pub struct MonolithId(Uuid);
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[typeshare(serialized_as = "String")]
pub struct BalancerId(Uuid);

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

impl From<&str> for RoomName {
    fn from(val: &str) -> Self {
        Self(val.into())
    }
}

impl Default for RoomName {
    fn default() -> Self {
        Self("".into())
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

impl From<BalancerId> for Uuid {
    fn from(val: BalancerId) -> Self {
        val.0
    }
}

impl From<Uuid> for BalancerId {
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

impl Display for BalancerId {
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

impl PartialEq for RoomName {
    fn eq(&self, other: &Self) -> bool {
        self.0.eq_ignore_ascii_case(&other.0)
    }
}

impl PartialOrd for RoomName {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.0
            .to_ascii_lowercase()
            .partial_cmp(&other.0.to_ascii_lowercase())
    }
}

impl Hash for RoomName {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        for c in self.0.chars() {
            c.to_ascii_lowercase().hash(state);
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn room_name_eq_itself() {
        let room = RoomName::from("foo");
        assert_eq!(room, room);
        let room2 = RoomName::from("foo");
        assert_eq!(room, room2);
    }

    #[test]
    fn room_name_case_insensitive() {
        let room1 = RoomName::from("foo");
        let room2 = RoomName::from("FOO");
        assert_eq!(room1, room2);
    }

    #[test]
    fn room_name_case_insensitive_hash() {
        let room1 = RoomName::from("foo");
        let room2 = RoomName::from("FOO");
        let mut map = std::collections::HashMap::new();
        map.insert(room1, 1);
        assert_eq!(map.get(&room2), Some(&1));
    }

    #[test]
    fn room_name_partial_ord() {
        // verifying the std implementation as reference
        assert!("Foo" < "bar");
        assert!("Foo" < "foo");
        assert!("Bar" < "foo");
        assert!("1" < "2");

        // verifying the custom implementation
        assert!(RoomName::from("Foo") > RoomName::from("bar"));
        assert_eq!(RoomName::from("Foo"), RoomName::from("foo"));
        assert!(RoomName::from("Bar") < RoomName::from("foo"));
        assert!(RoomName::from("1") < RoomName::from("2"));
    }

    #[test]
    fn room_name_ord() {
        // this is to verify we don't break the properies of Ord
        // probably would be better to have a property based test
        let a = RoomName::from("a");
        let b = RoomName::from("b");
        assert_eq!(a.partial_cmp(&b), Some(a.cmp(&b)));
    }

    #[test]
    fn room_name_preserve_casing_internally() {
        let room = RoomName::from("Foo");
        assert_eq!(room.0.as_ref(), "Foo");
        assert_ne!(room.0.as_ref(), "foo");
    }
}
