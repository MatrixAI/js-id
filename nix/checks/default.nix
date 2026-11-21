{
  pkgs,
  nodejs,
  lint,
  system,
  npmLibrary,
}:
let
  verify = pkgs.buildNpmPackage {
    pname = "id-verify";
    version = "0";
    inherit nodejs;
    src = npmLibrary.src;
    inherit (npmLibrary.npmDependencies) npmDeps npmConfigHook;
    dontNpmBuild = true;
    doCheck = true;
    checkPhase = ''
      runHook preCheck
      npm run check:conformance
      runHook postCheck
    '';
    installPhase = ''
      mkdir -p "$out/artifacts"
      cp -R tmp/junit "$out/artifacts/junit"
      cp -R tmp/package-candidate "$out/artifacts/package"
      cp tmp/portable-imports.json "$out/artifacts/portable-imports.json"
      cat > "$out/report.json" <<EOF
      {
        "schemaVersion": 1,
        "name": "verify",
        "kind": "conformance",
        "status": "passed",
        "system": "${system}",
        "summary": "Node 24 types, tests, package consumers, and declared Node import boundary passed",
        "artifacts": {
          "junit": "artifacts/junit",
          "package": "artifacts/package/report.json",
          "portableImports": "artifacts/portable-imports.json"
        }
      }
      EOF
    '';
  };
  lintCheck = lint.mkCheck {
    src = npmLibrary.src;
    name = "id-lint";
    npmDependencies = npmLibrary.npmDependencies // {
      inherit nodejs;
    };
  };
in
{
  inherit verify;
  lint = lintCheck;
  default = pkgs.runCommand "id-check-default" { } ''
    mkdir -p "$out/artifacts"
    ln -s ${verify} "$out/artifacts/verify"
    ln -s ${lintCheck} "$out/artifacts/lint"
    cat > "$out/report.json" <<EOF
    {
      "schemaVersion": 1,
      "name": "default",
      "kind": "aggregate",
      "status": "passed",
      "system": "${system}",
      "artifacts": {
        "verify": "artifacts/verify/report.json",
        "lint": "artifacts/lint/report.json"
      }
    }
    EOF
  '';
}
