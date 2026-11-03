{ pkgs, nodejs }:
let
  package = builtins.fromJSON (builtins.readFile ../package.json);
  packageLock = builtins.fromJSON (builtins.readFile ../package-lock.json);
  unpreparedGit = pkgs.lib.filterAttrs (
    _: module: pkgs.lib.hasPrefix "git" (module.resolved or "")
  ) packageLock.packages;
in
assert unpreparedGit == { } || throw "Git dependencies require reviewed prepared provider archives";
{
  npmDeps = pkgs.importNpmLock { inherit package packageLock; };
  npmConfigHook =
    (pkgs.callPackage (pkgs.path + /pkgs/build-support/node/import-npm-lock/hooks) { inherit nodejs; })
    .npmConfigHook;
}
