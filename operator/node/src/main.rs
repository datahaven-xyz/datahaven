//! Substrate Node Template CLI library.
#![warn(missing_docs)]

mod benchmarking;
mod chain_spec;
mod cli;
mod client;
mod command;
mod eth;
mod rpc;
mod service;

fn main() -> sc_cli::Result<()> {
    command::run()
}
