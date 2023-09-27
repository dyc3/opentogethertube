#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Test {
    name: String,
    function: fn(),
}

impl Test {
    pub fn new(name: String, function: fn()) -> Self {
        Self { name, function }
    }
}
