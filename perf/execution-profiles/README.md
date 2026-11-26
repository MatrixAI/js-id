# Execution profiles

[The schema](schema.json) records machine class, operating system, architecture,
runtime, scheduler, frequency policy, determinism, enforcement, and caveats. The
current local runner records an uncontrolled profile; the Nix check records a
harness-health profile and omits machine-specific timing observations.

Before retaining decision-relevant results, identify or embed a reviewed profile
and disclose whether isolation, affinity, scheduler, and frequency settings are
observed or enforced. A Nix-built runner by itself does not control the host.
