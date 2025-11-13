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

//! Governance tests for DataHaven Testnet Runtime
//!
//! This module contains comprehensive tests for the governance system,
//! including collective councils, custom origins, referenda with tracks,
//! and integration tests for complete governance workflows.

#[cfg(all(test, feature = "runtime-benchmarks"))]
pub mod benchmarks;
#[cfg(test)]
pub mod councils;
#[cfg(test)]
pub mod integration;
#[cfg(test)]
pub mod origins;
#[cfg(test)]
pub mod proxy;
#[cfg(test)]
pub mod referenda;
