use harness::TestRunner;
use test_context::test_context;

#[test_context(TestRunner)]
#[test]
fn sample_test(ctx: &mut TestRunner) {}

fn main() {}
