#[cfg(test)]
mod tests {
	use frame_support::traits::Contains;
	use snowbridge_core::AllowSiblingsOnly;
	use xcm::prelude::{Junction::Parachain, Location};

	#[test]
	fn allow_siblings_predicate_only_allows_siblings() {
		let sibling = Location::new(1, [Parachain(1000)]);
		let child = Location::new(0, [Parachain(1000)]);
		assert!(AllowSiblingsOnly::contains(&sibling), "Sibling returns true.");
		assert!(!AllowSiblingsOnly::contains(&child), "Child returns false.");
	}
}
