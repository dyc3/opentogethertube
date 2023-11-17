use super::*;

/// Defines how an emulated monolith should behave in response to messages from the balancer.
pub trait Behavior: Send {
    /// Processes the given message from the balancer, and returns messages to send back to the balancer.
    fn on_msg(&self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B>;
}

macro_rules! impl_behavior_tuple {
    ($($ty:ident),*) => {
        impl<$($ty: Behavior),*> Behavior for ($($ty,)*) {
            fn on_msg(&self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B> {
                #[allow(non_snake_case)]
                let ($($ty,)*) = self;
                let mut msgs = Vec::new();
                $(msgs.extend($ty.on_msg(msg, state));)*
                msgs
            }
        }
    };
}

impl_behavior_tuple!(A, B);
impl_behavior_tuple!(A, B, C);
impl_behavior_tuple!(A, B, C, D);
impl_behavior_tuple!(A, B, C, D, E);
impl_behavior_tuple!(A, B, C, D, E, F);

/// A Monoith behavior that does nothing.
#[derive(Debug, Clone, Copy)]
pub struct BehaviorManual;

impl Behavior for BehaviorManual {
    fn on_msg(&self, _msg: &MsgB2M, _state: &mut MonolithState) -> Vec<MsgM2B> {
        // do nothing
        vec![]
    }
}

/// A Monolith behavior that tries to behave exactly like a real monolith.
pub const BEHAVIOR_AUTO: (BehaviorTrackClients, BehaviorLoadRooms) =
    (BehaviorTrackClients, BehaviorLoadRooms);

/// Keep track of clients when they join and leave.
pub struct BehaviorTrackClients;

impl Behavior for BehaviorTrackClients {
    fn on_msg(&self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B> {
        match msg {
            MsgB2M::Join(join) => {
                state.clients.insert(join.client);
            }
            MsgB2M::Leave(leave) => {
                state.clients.remove(&leave.client);
            }
            _ => {}
        }

        vec![]
    }
}

/// Load rooms when requested, and unload them when requested, keeping track of the rooms and notifying the balancer.
pub struct BehaviorLoadRooms;

impl Behavior for BehaviorLoadRooms {
    fn on_msg(&self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B> {
        match msg {
            MsgB2M::Load(msg) => {
                let room = RoomMetadata::default_with_name(msg.room.clone());
                state.rooms.insert(room.name.clone(), room.clone());
                let loaded = M2BLoaded {
                    room,
                    load_epoch: state.room_load_epoch.fetch_add(1, Ordering::Relaxed),
                };
                return vec![loaded.into()];
            }
            MsgB2M::Unload(msg) => {
                state.rooms.remove(&msg.room);
                let unloaded = M2BUnloaded {
                    name: msg.room.clone(),
                };
                return vec![unloaded.into()];
            }
            MsgB2M::Join(msg) => {
                if !state.rooms.contains_key(&msg.room) {
                    let room = RoomMetadata::default_with_name(msg.room.clone());
                    state.rooms.insert(room.name.clone(), room.clone());
                    let loaded = M2BLoaded {
                        room,
                        load_epoch: state.room_load_epoch.fetch_add(1, Ordering::Relaxed),
                    };
                    return vec![loaded.into()];
                }
            }
            _ => {}
        }

        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_context::test_context;

    use crate::{Client, MonolithBuilder, TestRunner};

    #[test]
    fn behavior_should_load_rooms() {
        let b = BehaviorLoadRooms;
        let mut state = MonolithState::default();

        let msg = MsgB2M::Load(B2MLoad { room: "foo".into() });
        let msgs = b.on_msg(&msg, &mut state);
        assert!(matches!(msgs[0], MsgM2B::Loaded(_)));
        assert_eq!(state.rooms.len(), 1);
    }

    #[test]
    fn behavior_should_unload_rooms() {
        let b = BehaviorLoadRooms;
        let mut state = MonolithState::default();
        state
            .rooms
            .insert("foo".into(), RoomMetadata::default_with_name("foo"));

        let msg = MsgB2M::Unload(B2MUnload { room: "foo".into() });
        let msgs = b.on_msg(&msg, &mut state);
        assert!(matches!(msgs[0], MsgM2B::Unloaded(_)));
        assert_eq!(state.rooms.len(), 0);
    }

    #[test_context(TestRunner)]
    #[tokio::test]
    async fn should_track_rooms(ctx: &mut TestRunner) {
        let mut m = MonolithBuilder::new()
            .behavior(BehaviorLoadRooms)
            .build(ctx)
            .await;
        m.show().await;

        let mut c = Client::new(ctx).unwrap();
        c.join("foo").await;

        m.wait_recv().await;

        let s = m.state.lock().unwrap();
        assert_eq!(s.rooms.len(), 1);
    }

    #[test_context(TestRunner)]
    #[tokio::test]
    async fn should_track_clients(ctx: &mut TestRunner) {
        let mut m = MonolithBuilder::new()
            .behavior(BehaviorTrackClients)
            .build(ctx)
            .await;
        m.show().await;

        let mut c1 = Client::new(ctx).unwrap();
        c1.join("foo").await;

        m.wait_recv().await;
        assert_eq!(m.clients().len(), 1);

        c1.disconnect().await;
        m.wait_recv().await;
        assert_eq!(m.clients().len(), 0);
    }
}
