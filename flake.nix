{
  inputs = {
    nixpkgs-matrixai = {
      type = "indirect";
      id = "nixpkgs-matrixai";
    };
    nixpkgs.follows = "nixpkgs-matrixai/nixpkgs";
    flake-parts.follows = "nixpkgs-matrixai/flake-parts";
    devenv = {
      url = "github:cachix/devenv";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{
      nixpkgs-matrixai,
      flake-parts,
      devenv,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ devenv.flakeModule ];
      systems = [ "x86_64-linux" ];

      perSystem =
        { config, system, ... }:
        let
          pkgs = nixpkgs-matrixai.legacyPackages.${system};
          nodejs = pkgs.nodejs_24;
          lint = pkgs.matrixai-lint.withTools [
            pkgs.nixfmt
            pkgs.shellcheck
          ];
          src = nixpkgs-matrixai.lib.gitignore.gitignoreSource ./.;
          package = builtins.fromJSON (builtins.readFile ./package.json);
          npmDependencies = import ./nix/npm-deps.nix { inherit pkgs nodejs; };
          npmPackage = import ./nix/npm-package.nix {
            inherit
              pkgs
              nodejs
              src
              package
              npmDependencies
              ;
            sourceProvenance = {
              rev = if inputs.self ? dirtyRev then null else inputs.self.rev or null;
              dirtyRev = inputs.self.dirtyRev or null;
              narHash = inputs.self.narHash or null;
            };
          };
        in
        {
          packages = {
            default = npmPackage.out;
            npm-package = npmPackage.out;
            npm-package-unpacked = npmPackage.unpacked;
          };
          formatter = lint.formatter;
          checks = import ./nix/checks {
            inherit
              pkgs
              nodejs
              lint
              src
              npmDependencies
              system
              ;
          };
          devShells.ci = config.devShells.default;
          devenv.shells.default = { lib, ... }: {
            containers = lib.mkForce { };
            devenv.root = lib.mkForce (
              let
                root = builtins.getEnv "PWD";
              in
              if root == "" then toString ./. else root
            );
            packages = [
              nodejs
              lint
              pkgs.gnutar
            ];
            enterShell = ''
              export PATH="${lint}/bin:$PWD/node_modules/.bin:$PATH"
            '';
          };
        };
    };
}
