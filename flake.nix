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
          npmLibrary = nixpkgs-matrixai.lib.npmBridge.producer.libraryFromRoot {
            inherit pkgs nodejs;
            gitignore = nixpkgs-matrixai.lib.gitignore;
            root = ./.;
            self = inputs.self;
          };
        in
        {
          packages = {
            default = npmLibrary.npmPackage.out;
            npm-build = npmLibrary.npmBuild;
            npm-package = npmLibrary.npmPackage.out;
            npm-package-unpacked = npmLibrary.npmPackage.unpacked;
          };
          formatter = lint.formatter;
          checks = import ./nix/checks {
            inherit
              pkgs
              nodejs
              lint
              system
              npmLibrary
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
              (pkgs.lib.hiPrio npmLibrary.npm)
              lint
            ];
            enterShell = ''
              mkdir -p "$PWD/tmp"
              export PATH="${npmLibrary.npm}/bin:${lint}/bin:$PWD/node_modules/.bin:$PATH"
            '';
          };
        };
    };
}
