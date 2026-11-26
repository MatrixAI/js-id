{
  pkgs,
  nodejs,
  system,
  src,
  setupDependencies,
  browserBundle,
}:
let
  playwright = pkgs.playwright-driver;
in
pkgs.stdenv.mkDerivation {
  pname = "integration-browser";
  version = "0.1.0";
  inherit src;
  nativeBuildInputs = [ nodejs ];
  nativeCheckInputs = [ playwright.browsers ];
  CHECK_SYSTEM = system;
  LIBRARY_BUNDLE = "${browserBundle}/browser.js";
  PLAYWRIGHT_BROWSERS_PATH = playwright.browsers;
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
  FONTCONFIG_FILE = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
  dontBuild = true;
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME"
    ${setupDependencies}
    mkdir -p tmp/integration-browser/artifacts
    bash ./nix/checks/browser/run.sh
    runHook postCheck
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/artifacts"
    cp -R tmp/integration-browser/artifacts/. "$out/artifacts/"
    cat > "$out/report.json" <<EOF
    {
      "schemaVersion": 1,
      "name": "integration-browser",
      "kind": "integration",
      "status": "passed",
      "system": "${system}",
      "summary": "Chromium document and dedicated-worker integration passed; not deployed-platform evidence",
      "artifacts": {
        "playwright": "artifacts/playwright.json"
      }
    }
    EOF
    runHook postInstall
  '';
}
