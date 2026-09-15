# Gates: translate the repository to English

OWNS: AGENTS.md, README.md, CHANGELOG.md, CONTEXT.md, docs/**, packages/**, scripts/**, package.json, pnpm-workspace.yaml, docker-compose.yml, GATES.md

Scope: translate repository code, documentation, metadata, comments, tests, and user-facing strings to English while preserving behavior and the existing feature work

- [x] G0: this ledger uses valid, meaningful runnable oracles
  CHECK: node /home/saito/.agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=48630b7361dd44ee870917b12c3d19b9d7bdea738aaca16bb04d4cab83b772d2; output-bytes=8

- [x] G1: repository text contains no detected Portuguese or Spanish prose
  CHECK: node scripts/check-english.mjs
  EXPECT: ENGLISH CHECK PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=b784cbc2cce8368d2b715f94a35a1f374c01486b04482149a33ba142b96344ad; output-bytes=21

- [x] G2: the complete test suite passes after translation
  CHECK: pnpm test && node -e "console.log('FULL TEST SUITE PASSED')"
  EXPECT: FULL TEST SUITE PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=de448ff2ee89f637de5b58fdede8933b26be712feafdbc9af552f9020a1ad884; output-bytes=13761

- [x] G3: host/add-on dependency boundaries remain valid
  CHECK: pnpm check:host-boundary && node -e "console.log('HOST BOUNDARY PASSED')"
  EXPECT: HOST BOUNDARY PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=b851c246c56ca0d840d9aa6d1d1ce5abb9bc5e6fb6500708b29a346904e90664; output-bytes=117

- [x] G4: the host production build passes after translation
  CHECK: pnpm build:host && node -e "console.log('HOST BUILD PASSED')"
  EXPECT: HOST BUILD PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=8164f043bca35f83b9d7b2c884fb0ac9910af7f4f7dbfb2c49009ac2e50b2f3a; output-bytes=830

- [x] G5: changed files have no whitespace errors
  CHECK: git diff --check && node -e "console.log('DIFF CHECK PASSED')"
  EXPECT: DIFF CHECK PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=66671e82b73c711a7cb142c694698be50561b11d373dca2aff1cba62751742f6; output-bytes=18

- [x] G6: documentation references and translated file names are internally consistent
  CHECK: node scripts/check-english.mjs --references
  EXPECT: REFERENCE CHECK PASSED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/home/saito/_git/ac/addons-app-poc; path=5643f64f3b7c/21 entries; EXPECT=matched; output-sha256=cf9b955ec6df61fb7ac47b7c182bd89939ad9af106e7dedb107179105a121b21; output-bytes=44
