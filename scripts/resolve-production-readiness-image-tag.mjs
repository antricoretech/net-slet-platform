import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function resolveImageTag({ eventName, ref, sha, input }) {
  if (!SHA_PATTERN.test(sha)) {
    throw new Error('GITHUB_SHA must be a complete 40-character lowercase hexadecimal commit SHA.');
  }

  if (eventName === 'push' && ref === 'refs/heads/main') {
    return sha;
  }

  if (eventName === 'workflow_dispatch') {
    if (!SHA_PATTERN.test(input)) {
      throw new Error('workflow_dispatch image_tag must be a complete 40-character lowercase hexadecimal commit SHA.');
    }
    if (input !== sha) {
      throw new Error('workflow_dispatch image_tag must equal GITHUB_SHA.');
    }
    return input;
  }

  throw new Error(`Unsupported production-readiness event: ${eventName} ${ref}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const imageTag = resolveImageTag({
      eventName: process.env.GITHUB_EVENT_NAME ?? '',
      ref: process.env.GITHUB_REF ?? '',
      sha: process.env.GITHUB_SHA ?? '',
      input: process.env.IMAGE_TAG_INPUT ?? '',
    });

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `image_tag=${imageTag}\n`);
    } else {
      console.log(`image_tag=${imageTag}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
