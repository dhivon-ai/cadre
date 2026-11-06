import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { releaseChannel } from "../scripts/release-channel.js";

test("stable release tags select latest only when the package version matches", () => {
  for (const tag of ["release-4.1.0", "v4.1.0", "4.1.0"]) {
    assert.deepEqual(releaseChannel("release", tag, "4.1.0"), { version: "4.1.0", channel: "latest" });
  }
  assert.throws(() => releaseChannel("release", "release-4.1.0", "4.0.0"), /Tag resolves/);
});

test("publication rejects prereleases, malformed tags, and output injection", () => {
  for (const tag of ["release-4.1.0-rc.1", "4.1.0+build.1", "release-04.1.0", "release-4.1", "main", "release-4.1.0\n", "release-4.1.0\nchannel=next"]) {
    assert.throws(() => releaseChannel("release", tag, "4.1.0"), /Stable publication/);
  }
});

test("pushing a tag or manually dispatching cannot publish", () => {
  for (const event of ["push", "workflow_dispatch", "pull_request", ""]) {
    assert.throws(() => releaseChannel(event, "release-4.1.0", "4.1.0"), /Unsupported/);
  }
});

test("release automation requires a published stable release and preserves OIDC", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.match(workflow, /release:\s+types: \[published\]/);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /if: github.event_name == 'release' && !github.event.release.prerelease/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /needs: \[publish-npm, verify-npm\]/);
});
