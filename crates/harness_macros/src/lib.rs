use once_cell::sync::Lazy;
use proc_macro2::{Span, TokenStream};
use quote::quote;
use syn::parse_macro_input;

use std::sync::{Mutex, OnceLock};

static mut TESTS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[proc_macro_attribute]
pub fn balancer_test(
    attr: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let _item = item.clone();
    let func = parse_macro_input!(_item as syn::ItemFn);
    let name = func.sig.ident.to_string();

    let t = unsafe { TESTS.get_mut().unwrap() };
    t.push(name);

    item
}

/// Aggregates all the tests into a vector of `Test` structs.
///
/// Must be called **after** all the tests have been defined with `balancer_test`.
#[proc_macro]
pub fn aggregate_tests(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let names = unsafe { TESTS.get_mut().unwrap() };

    let mut tests = TokenStream::new();
    for name in names.iter() {
        let ident = syn::Ident::new(name, Span::call_site());
        tests.extend(quote! {
            ::harness::Test::new(#name.to_string(), #ident),
        });
    }

    quote! {
        Vec::from([#tests])
    }
    .into()
}
