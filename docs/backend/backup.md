# Backup and restore verification

Enable D1 Time Travel for short recovery but treat it as insufficient portable backup. Scheduled backup produces a separately permissioned encrypted database export plus R2 object/evidence checksums and configuration, schema, and encryption-key-version manifests. Maintain an independently controlled copy. Do not place recovery keys with ciphertext; verify recovery access separately.

At least quarterly, restore into an isolated environment: validate manifest checksums, verify key decryptability without logging plaintext, restore database and objects, replay suppression/DNC ledger, then permit scheduler release. Record result, manifest digest, restored object count, key-version result, operator, and time. Bucket locks are administrative retention controls, not a regulatory WORM assertion.
