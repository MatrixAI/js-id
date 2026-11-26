{
  pkgs,
  nodejs,
  npmLibrary,
}:
let
  python = pkgs.python3.withPackages (packages: [ packages.jsonschema ]);
  baseline = builtins.fromJSON (builtins.readFile ../perf/baselines/sortable-git.provider.json);
  baselineSource = builtins.fetchTree {
    type = "github";
    owner = "MatrixAI";
    repo = "js-id";
    rev = baseline.source.revision;
    narHash = baseline.source.narHash;
  };
  instrument = pkgs.stdenv.mkDerivation {
    pname = "id-perf-instrument";
    version = "0.1.0";
    src = npmLibrary.src;
    nativeBuildInputs = [
      pkgs.esbuild
      nodejs
    ];
    dontBuild = true;
    installPhase = ''
      ${npmLibrary.setupDependencies}
      cp -R ${npmLibrary.npmBuild}/dist dist
      mkdir -p "$out/share/id-perf"
      cp -R perf/. "$out/share/id-perf/"
      esbuild dist/index.js --bundle --platform=node --format=esm \
        --target=node24 --outfile="$out/share/id-perf/benches/candidate.mjs"
      node perf/benches/prepare-baseline.mjs ${baselineSource}/src/IdSortable.ts tmp-baseline.ts
      esbuild tmp-baseline.ts --platform=node --format=esm --target=node24 \
        --outfile="$out/share/id-perf/benches/baseline.mjs"
    '';
  };
  validator = pkgs.writeShellScript "id-perf-validate" ''
    exec ${python}/bin/python ${instrument}/share/id-perf/benches/validate.py "$@"
  '';
in
pkgs.writeShellScriptBin "id-perf" ''
  export ID_PERF_VALIDATOR=${validator}
  exec ${nodejs}/bin/node ${instrument}/share/id-perf/benches/run.mjs "$@"
''
