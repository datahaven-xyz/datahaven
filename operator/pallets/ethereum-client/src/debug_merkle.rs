// Debug helper for merkle proof validation
use hex_literal::hex;
use snowbridge_beacon_primitives::{
    merkle_proof::{generalized_index_length, subtree_index},
    verify_merkle_branch, SyncCommittee,
};
use sp_core::H256;

#[cfg(test)]
mod tests {
    use super::*;
    use snowbridge_pallet_ethereum_client_fixtures::make_checkpoint;

    #[test]
    fn debug_sync_committee_merkle_proof() {
        // Get the fixture data
        let checkpoint = make_checkpoint();
        
        // Calculate sync committee hash
        let sync_committee_root = checkpoint
            .current_sync_committee
            .hash_tree_root()
            .expect("Failed to hash sync committee");
        
        println!("=== Debugging Sync Committee Merkle Proof ===");
        println!("Header slot: {}", checkpoint.header.slot);
        println!("State root: {:?}", checkpoint.header.state_root);
        println!("Sync committee root: {:?}", sync_committee_root);
        println!("Branch length: {}", checkpoint.current_sync_committee_branch.len());
        println!("Branch:");
        for (i, node) in checkpoint.current_sync_committee_branch.iter().enumerate() {
            println!("  [{}]: {:?}", i, node);
        }
        
        // Calculate the gindex for current sync committee
        // Based on the slot and fork versions
        let sync_committee_gindex = 27u64; // This is the typical gindex for current_sync_committee
        
        println!("\nMerkle proof parameters:");
        println!("  Generalized index: {}", sync_committee_gindex);
        println!("  Subtree index: {}", subtree_index(sync_committee_gindex));
        println!("  Depth: {}", generalized_index_length(sync_committee_gindex));
        
        // Verify the merkle branch
        let is_valid = verify_merkle_branch(
            sync_committee_root,
            &checkpoint.current_sync_committee_branch,
            subtree_index(sync_committee_gindex),
            generalized_index_length(sync_committee_gindex),
            checkpoint.header.state_root,
        );
        
        println!("\nMerkle proof is valid: {}", is_valid);
        
        if !is_valid {
            // Let's try to understand why it's failing
            println!("\n=== Debugging merkle proof failure ===");
            
            // Try different gindex values that might be used
            let possible_gindices = vec![27u64, 54u64, 55u64]; // Common values for sync committee
            
            for gindex in possible_gindices {
                let valid = verify_merkle_branch(
                    sync_committee_root,
                    &checkpoint.current_sync_committee_branch,
                    subtree_index(gindex),
                    generalized_index_length(gindex),
                    checkpoint.header.state_root,
                );
                println!("Gindex {} -> valid: {}", gindex, valid);
            }
        }
    }
    
    #[test]
    fn compare_json_vs_hardcoded_merkle_branch() {
        // Load JSON data
        let json_content = std::fs::read_to_string(
            "/workspace/datahaven/operator/pallets/ethereum-client/tests/fixtures/initial-checkpoint.json"
        ).expect("Failed to read JSON fixture");
        
        // Parse JSON to extract the merkle branch
        let json_data: serde_json::Value = serde_json::from_str(&json_content)
            .expect("Failed to parse JSON");
        
        // Get hardcoded fixture
        let checkpoint = make_checkpoint();
        
        println!("=== Comparing JSON vs Hardcoded Merkle Branches ===");
        
        if let Some(json_branch) = json_data["current_sync_committee_branch"].as_array() {
            println!("JSON branch length: {}", json_branch.len());
            println!("Hardcoded branch length: {}", checkpoint.current_sync_committee_branch.len());
            
            for (i, (json_node, hardcoded_node)) in json_branch.iter()
                .zip(checkpoint.current_sync_committee_branch.iter())
                .enumerate() 
            {
                let json_hex = json_node.as_str().unwrap_or("");
                let hardcoded_hex = format!("0x{}", hex::encode(hardcoded_node));
                
                println!("\nBranch[{}]:", i);
                println!("  JSON:      {}", json_hex);
                println!("  Hardcoded: {}", hardcoded_hex);
                println!("  Match: {}", json_hex == hardcoded_hex);
            }
        }
    }
}