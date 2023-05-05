use clap::{Parser, ValueEnum};

/// Simple program to greet a person
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Args {
    #[arg(short, long, value_enum)]
    pub mode: ClientMode,

    #[arg(short, long, default_value = "test")]
    pub room: String,

    #[arg(
        long,
        help = "Whether the client should create echo messages from stdin instead of just sending stdin verbatim"
    )]
    pub echo: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, ValueEnum)]
pub enum ClientMode {
    Client,
    Monolith,
}
