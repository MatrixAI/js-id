import json
import hashlib
import pathlib
import sys

from jsonschema import Draft202012Validator

root = pathlib.Path(__file__).resolve().parent.parent
output = pathlib.Path(sys.argv[1])


def read(path):
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def validate(schema_path, data_path):
    schema = read(root / schema_path)
    Draft202012Validator.check_schema(schema)
    data = read(output / data_path)
    Draft202012Validator(schema).validate(data)
    return data


provider = validate("baselines/schema.json", "provider.json")
profile = validate("execution-profiles/schema.json", "execution-profile.json")
result = validate("results/schema.json", "runner/result.json")
candidate = result["candidate"]
if hashlib.sha256(pathlib.Path(candidate["path"]).read_bytes()).hexdigest() != candidate["sha256"]:
    raise ValueError("Candidate hash does not match the measured module")
if provider["providerKind"] != "none":
    source = provider["source"]
    if hashlib.sha256(pathlib.Path(source["path"]).read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError("Baseline hash does not match the measured module")
if provider["providerKind"] == "git-ref":
    record = read(root / "baselines/sortable-git.provider.json")
    schema = read(root / "baselines/schema.json")
    Draft202012Validator(schema).validate(record)
    for key in ("repository", "revision", "narHash", "acquisition"):
        if provider["source"][key] != record["source"][key]:
            raise ValueError("Pinned provider metadata differs from its record")
samples = result["samplesMs"]
expected = {
    "sortable-zero-candidate",
    "sortable-crypto-candidate",
    "sha256-name-candidate",
    "flake-seq12-node62",
    "flake-seq42-node32",
    "flake-seq12-node32-crypto",
}
if provider["providerKind"] in {"local-worktree", "git-ref"}:
    expected.update({"sortable-zero-baseline", "sortable-crypto-baseline"})
if set(samples) != expected or any(
    len(values) != result["scenario"]["samples"] for values in samples.values()
):
    raise ValueError("Sample cases or counts do not match the scenario and provider")
if result["evidenceClass"] == "harness-health" and (
    profile["profileKind"] != "nix-harness-health"
    or provider["providerKind"] not in {"none", "git-ref"}
    or result["scenario"]["samples"] != 0
):
    raise ValueError("Harness health requires the Nix profile and no local baseline")
if result["evidenceClass"] == "exploratory" and result["scenario"]["samples"] < 1:
    raise ValueError("Exploratory results require timing samples")
