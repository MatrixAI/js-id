{
  pkgs,
  nodejs,
  lint,
  system,
  npmLibrary,
  perfRunner,
}:
let
  unit-js = pkgs.stdenv.mkDerivation {
    pname = "id-unit-js";
    version = "0.1.0";
    src = npmLibrary.src;
    nativeBuildInputs = [ nodejs ];
    dontBuild = true;
    doCheck = true;
    checkPhase = ''
      runHook preCheck
      ${npmLibrary.setupDependencies}
      # Vitest 5.1 writes typecheck state beside its own package.
      mkdir -p tmp/vitest
      cp -R ${npmLibrary.installedDependencies}/node_modules/vitest tmp/vitest/package
      chmod -R u+w tmp/vitest/package
      rm node_modules/vitest
      ln -s ../tmp/vitest/package node_modules/vitest
      ln -s ${npmLibrary.npmBuild}/dist dist
      ./node_modules/.bin/tsc -p ./tsconfig.json --incremental false
      npm test -- --prebuilt
      runHook postCheck
    '';
    installPhase = ''
      runHook preInstall
      mkdir -p "$out/artifacts"
      cp -R tmp/junit "$out/artifacts/junit"
      cat > "$out/report.json" <<EOF
      {
        "schemaVersion": 1,
        "name": "unit-js",
        "kind": "unit-test",
        "status": "passed",
        "system": "${system}",
        "summary": "Full-project typechecking and Vitest cases passed",
        "artifacts": { "junit": "artifacts/junit" }
      }
      EOF
      runHook postInstall
    '';
  };
  lintCheck = lint.mkCheck {
    src = npmLibrary.src;
    name = "id-lint";
    npmDependencies = npmLibrary.npmDependencies // {
      inherit nodejs;
    };
  };
  integration-browser = import ./browser.nix {
    inherit
      pkgs
      nodejs
      system
      npmLibrary
      ;
  };
  perf-bench-smoke = import ./perf-bench-smoke.nix {
    inherit pkgs system perfRunner;
  };
in
{
  inherit unit-js integration-browser perf-bench-smoke;
  lint = lintCheck;
  default = pkgs.runCommand "id-check-default" { } ''
    mkdir -p "$out/artifacts"
    ln -s ${unit-js} "$out/artifacts/unit-js"
    ln -s ${lintCheck} "$out/artifacts/lint"
    cat > "$out/report.json" <<EOF
    {
      "schemaVersion": 1,
      "name": "default",
      "kind": "aggregate",
      "status": "passed",
      "system": "${system}",
      "artifacts": {
        "unit-js": "artifacts/unit-js/report.json",
        "lint": "artifacts/lint/report.json"
      }
    }
    EOF
  '';
}
