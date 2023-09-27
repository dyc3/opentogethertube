use harness::{aggregate_tests, balancer_test, Test};

#[balancer_test]
fn sample_test() {}

fn main() {
    let tests: Vec<Test> = aggregate_tests!();

    println!("Found tests: {:?}", tests);
}
