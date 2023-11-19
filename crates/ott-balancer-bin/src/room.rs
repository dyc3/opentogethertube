use ott_balancer_protocol::MonolithId;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct RoomLocator {
    monolith_id: MonolithId,
    load_epoch: u32,
}

impl RoomLocator {
    pub(crate) fn new(monolith_id: MonolithId, load_epoch: u32) -> Self {
        Self {
            monolith_id,
            load_epoch,
        }
    }

    pub(crate) fn monolith_id(&self) -> MonolithId {
        self.monolith_id
    }

    pub(crate) fn load_epoch(&self) -> u32 {
        self.load_epoch
    }
}
