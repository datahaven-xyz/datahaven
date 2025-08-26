//! Governance tests for DataHaven Stagenet Runtime
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
pub mod referenda;
