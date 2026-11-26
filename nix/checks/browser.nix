{
  pkgs,
  nodejs,
  system,
  npmLibrary,
}:
pkgs.stdenv.mkDerivation {
  pname = "id-integration-browser";
  version = "0.1.0";
  src = npmLibrary.src;
  nativeBuildInputs = [
    nodejs
    pkgs.esbuild
    pkgs.chromium
  ];
  dontBuild = true;
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME" tmp/integration-browser
    ${npmLibrary.setupDependencies}
    cp -R ${npmLibrary.npmBuild}/dist dist
    esbuild tests/browser/fixture.ts --bundle --platform=browser --format=esm \
      --target=es2022 --outfile=tmp/integration-browser/browser.js
    esbuild tests/browser/worker.ts --bundle --platform=browser --format=esm \
      --target=es2022 --outfile=tmp/integration-browser/worker.js
    cat > tmp/integration-browser/index.html <<'EOF'
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8">
    <title>Identifier browser integration</title>
    <script type="module" src="./browser.js"></script></head>
    <body><pre id="result" data-status="pending">Browser integration pending</pre></body></html>
    EOF
    timeout 60s chromium --headless --no-sandbox --disable-gpu \
      --disable-dev-shm-usage --disable-background-networking \
      --allow-file-access-from-files --user-data-dir="$TMPDIR/chromium" \
      --virtual-time-budget=10000 --dump-dom \
      "file://$PWD/tmp/integration-browser/index.html" \
      > tmp/integration-browser/result.html 2> tmp/integration-browser/browser.log
    cat tmp/integration-browser/result.html
    grep -q 'data-status="passed"' tmp/integration-browser/result.html
    runHook postCheck
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/artifacts"
    cp tmp/integration-browser/result.html "$out/artifacts/"
    cp tmp/integration-browser/browser.log "$out/artifacts/"
    cat > "$out/report.json" <<EOF
    {
      "schemaVersion": 1,
      "name": "integration-browser",
      "kind": "integration",
      "status": "passed",
      "system": "${system}",
      "summary": "Chromium document and dedicated-worker integration passed; not deployed-platform evidence",
      "artifacts": {
        "result": "artifacts/result.html",
        "browser-log": "artifacts/browser.log"
      }
    }
    EOF
    runHook postInstall
  '';
}
