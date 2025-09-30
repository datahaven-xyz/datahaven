use log::error;
use serde::Deserialize;
use std::fs::File;
use std::io::prelude::*;
use std::path::Path;
use toml;

use shc_client::builder::{FishermanOptions, IndexerOptions};

use crate::command::ProviderOptions;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub provider: ProviderOptions,
    pub indexer: IndexerOptions,
    pub fisherman: FishermanOptions,
}

pub fn read_config(path: &str) -> Option<Config> {
    let path = Path::new(path);

    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(err) => {
            error!("Failed to open config file: {}", err);
            return None;
        }
    };
    let mut contents = String::new();
    if let Err(err) = file.read_to_string(&mut contents) {
        error!("Fail to read config file : {}", err);

        return None;
    };

    let config = match toml::from_str(&contents) {
        Err(err) => {
            error!("Fail to parse config file : {}", err);

            return None;
        }
        Ok(c) => c,
    };

    return Some(config);
}
