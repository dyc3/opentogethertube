use super::*;

/// Defines how an emulated monolith should behave in response to messages from the balancer.
pub trait Behavior {
    /// Processes the given message from the balancer, and returns messages to send back to the balancer.
    fn on_msg(&mut self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B>;
}

/// A Monoith behavior that does nothing.
#[derive(Debug, Clone, Copy)]
pub struct BehaviorManual;

impl Behavior for BehaviorManual {
    fn on_msg(&mut self, _msg: &MsgB2M, _state: &mut MonolithState) -> Vec<MsgM2B> {
        // do nothing
        vec![]
    }
}

/// A Monolith behavior that tries to behave exactly like a real monolith.
pub struct BehaviorAuto;

impl Behavior for BehaviorAuto {
    fn on_msg(&mut self, msg: &MsgB2M, state: &mut MonolithState) -> Vec<MsgM2B> {
        match msg {
            MsgB2M::Load(msg) => {
                let room = RoomMetadata::default_with_name(msg.room.clone());
                let loaded = M2BLoaded {
                    room,
                    load_epoch: state.room_load_epoch.fetch_add(1, Ordering::Relaxed),
                };
                return vec![loaded.into()];
            }
            MsgB2M::Unload(_) => todo!(),
            MsgB2M::Join(_) => todo!(),
            MsgB2M::Leave(_) => todo!(),
            MsgB2M::ClientMsg(_) => todo!(),
        }

        vec![]
    }
}
