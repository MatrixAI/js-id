# Baseline providers

Baseline records identify the comparison subject independently of the machine
profile. The pinned Git provider acquires the earlier sortable source by
revision and Nix hash, but adapts its imports to the candidate helpers; it is
not a full historical build. The provider's layout and generator semantics
differ from the candidate. Local modules are explicitly selected, mutable, and
exploratory only.

Validate provider records using [the schema](schema.json) and the packaged
runner. A durable source pin alone does not make an uncontrolled measurement a
budget or release gate. Flake measurements currently have no prior baseline.
