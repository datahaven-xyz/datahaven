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

    if !path.exists() {
        error!("Fail to find config file ({:?})", path);

        return None;
    }

    let mut file = File::open(path).expect("config.toml file should exist");
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
