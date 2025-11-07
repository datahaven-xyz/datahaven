// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

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
