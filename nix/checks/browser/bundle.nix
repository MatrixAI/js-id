{
  pkgs,
  nodejs,
  src,
  npmBuild,
  setupDependencies,
  ...
}:
let
  bundleSource = pkgs.lib.cleanSourceWith {
    inherit src;
    filter =
      path: _type:
      let
        relative = pkgs.lib.removePrefix "${toString src}/" (toString path);
      in
      # The library build must not consume tests, specs, or check adapters.
      !(builtins.elem relative [
        "tests"
        "specs"
        "nix/checks"
        "playwright.config.ts"
      ]);
  };
in
pkgs.stdenv.mkDerivation {
  pname = "library-browser-bundle";
  version = "0.1.0";
  src = bundleSource;
  nativeBuildInputs = [
    nodejs
    pkgs.jq
  ];
  buildPhase = ''
    runHook preBuild
    ${setupDependencies}
    cp -R ${npmBuild}/dist dist
    bash ${./bundle.sh}
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p "$out"
    cp tmp/integration-browser/browser.js "$out/"
    runHook postInstall
  '';
}
