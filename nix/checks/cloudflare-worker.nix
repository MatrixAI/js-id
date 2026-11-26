{
  pkgs,
  nodejs,
  system,
  npmLibrary,
}:
pkgs.stdenv.mkDerivation {
  pname = "id-integration-cloudflare-worker";
  version = "0.1.0";
  src = npmLibrary.src;
  nativeBuildInputs = [
    nodejs
    pkgs.patchelf
  ];
  SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
  dontBuild = true;
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR/home"
    export CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false
    export CLOUDFLARE_INCLUDE_PROCESS_ENV=false
    mkdir -p "$HOME" tmp/junit
    cp -RL ${npmLibrary.installedDependencies}/node_modules node_modules
    chmod -R u+w node_modules
    patchelf --set-interpreter "${pkgs.stdenv.cc.bintools.dynamicLinker}" \
      node_modules/@cloudflare/workerd-linux-64/bin/workerd
    cp -R ${npmLibrary.npmBuild}/dist dist
    npm test -- --prebuilt --config vitest.cloudflare-worker.config.mts
    runHook postCheck
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/artifacts"
    cp tmp/junit/cloudflare-worker.xml "$out/artifacts/"
    cat > "$out/report.json" <<EOF
    {
      "schemaVersion": 1,
      "name": "integration-cloudflare-worker",
      "kind": "integration",
      "status": "passed",
      "system": "${system}",
      "summary": "Local Cloudflare workerd integration passed; not deployed-platform evidence",
      "artifacts": { "junit": "artifacts/cloudflare-worker.xml" }
    }
    EOF
    runHook postInstall
  '';
}
