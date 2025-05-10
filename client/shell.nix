{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShellNoCC {
  nativeBuildInputs = with pkgs.buildPackages; [
    nodejs_22
    bun
    typescript
    biome
    prettierd
  ];

  # Dynamically determine the biome binary path based on the installed package
  BIOME_BINARY="${pkgs.buildPackages.biome}/bin/biome npx @biomejs/biome format .";

  shellHook = ''
    echo "Development environment ready!"
  '';
}
