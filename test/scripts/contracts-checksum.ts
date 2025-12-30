// @ts-nocheck

import { createHash } from "crypto";
import type { Dirent } from "fs";
import { readdirSync, readFileSync } from "fs";
import path from "path";

/**
 * Recursively walks a directory and feeds all file contents into a SHA1 hash.
 * This ensures that any change in nested contract files is reflected
 * in the resulting checksum.
 */
export function generateContractsChecksum(contractsPath: string): string {
  const root = path.resolve(contractsPath);
  const hash = createHash("sha1");

  const visit = (dir: string) => {
    const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });

    // Ensure deterministic ordering across platforms
    entries
      .slice()
      .sort((a: Dirent, b: Dirent) => a.name.localeCompare(b.name))
      .forEach((entry: Dirent) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          visit(fullPath);
        } else if (entry.isFile()) {
          const data = readFileSync(fullPath);
          hash.update(data);
        }
      });
  };

  visit(root);

  return hash.digest("hex");
}
