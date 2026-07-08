#!/usr/bin/env node

import http from "node:http";
import https from "node:https";

const LEGACY_ORIGIN = process.env.M5_LEGACY_ORIGIN ?? "https://app.whatif-ep.xyz";
const CANONICAL_ORIGIN = process.env.M5_CANONICAL_ORIGIN ?? "https://whatif-ep.xyz";
const REQUEST_BASE = process.env.M5_REQUEST_BASE ?? null;

const cases = [
  {
    name: "banner query",
    path: "/banner?template=test-template",
    expected: [{ status: 301, location: `${CANONICAL_ORIGIN}/?template=test-template` }],
  },
  {
    name: "banner detail",
    path: "/banner/test-banner-id",
    expected: [{ status: 301, location: `${CANONICAL_ORIGIN}/` }],
  },
  {
    name: "banners list",
    path: "/banners",
    expected: [{ status: 301, location: `${CANONICAL_ORIGIN}/` }],
  },
  {
    name: "banners size",
    path: "/banners/mobile-hd",
    expected: [{ status: 301, location: `${CANONICAL_ORIGIN}/` }],
  },
  {
    name: "upgrade",
    path: "/upgrade?source=gallery",
    expected: [{ status: 301, location: `${CANONICAL_ORIGIN}/?source=gallery` }],
  },
];

function toFetchTarget(logicalUrl) {
  if (!REQUEST_BASE) {
    return {
      url: logicalUrl,
      hostHeader: null,
    };
  }

  const parsedLogical = new URL(logicalUrl);
  const parsedBase = new URL(REQUEST_BASE);

  return {
    url: `${parsedBase.origin}${parsedLogical.pathname}${parsedLogical.search}${parsedLogical.hash}`,
    hostHeader: parsedLogical.host,
  };
}

async function requestOnce(logicalUrl) {
  const target = toFetchTarget(logicalUrl);
  const headers = {
    "user-agent": "whatif-m5-redirect-check/1.0",
  };

  if (target.hostHeader) {
    headers.host = target.hostHeader;
  }

  const response = await new Promise((resolve, reject) => {
    const parsedTarget = new URL(target.url);
    const client = parsedTarget.protocol === "https:" ? https : http;

    const request = client.request(
      parsedTarget,
      {
        method: "GET",
        headers,
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
        });
      },
    );

    request.on("error", reject);
    request.end();
  });

  const rawLocation = Array.isArray(response.headers.location)
    ? response.headers.location[0] ?? null
    : response.headers.location ?? null;
  const location = rawLocation ? new URL(rawLocation, logicalUrl).toString() : null;

  return {
    status: response.status,
    location,
    rawLocation,
    requestUrl: target.url,
    hostHeader: target.hostHeader,
  };
}

async function checkCase(testCase) {
  const chain = [];
  let url = `${LEGACY_ORIGIN}${testCase.path}`;

  for (let i = 0; i < testCase.expected.length; i += 1) {
    const step = await requestOnce(url);
    chain.push(step);

    if (!step.location) {
      throw new Error(
        `${testCase.name}: missing location header at step ${i + 1} (status ${step.status})`,
      );
    }

    url = step.location;
  }

  const mismatches = testCase.expected.flatMap((expectedStep, index) => {
    const actual = chain[index];
    const errors = [];

    if (actual.status !== expectedStep.status) {
      errors.push(
        `step ${index + 1} status expected ${expectedStep.status} but got ${actual.status}`,
      );
    }

    if (actual.location !== expectedStep.location) {
      errors.push(
        `step ${index + 1} location expected ${expectedStep.location} but got ${actual.location}`,
      );
    }

    return errors;
  });

  return {
    name: testCase.name,
    ok: mismatches.length === 0,
    mismatches,
    chain,
  };
}

async function main() {
  console.log(`Legacy origin:    ${LEGACY_ORIGIN}`);
  console.log(`Canonical origin: ${CANONICAL_ORIGIN}`);
  if (REQUEST_BASE) {
    console.log(`Request base:     ${REQUEST_BASE}`);
  }

  let failed = false;

  for (const testCase of cases) {
    try {
      const result = await checkCase(testCase);
      if (result.ok) {
        console.log(`PASS ${result.name}`);
        result.chain.forEach((step, index) => {
          console.log(
            `  ${index + 1}. ${step.status} -> ${step.location} (raw: ${step.rawLocation}, request: ${step.requestUrl}, host: ${step.hostHeader ?? "-"})`,
          );
        });
        continue;
      }

      failed = true;
      console.error(`FAIL ${result.name}`);
      result.mismatches.forEach((message) => {
        console.error(`  - ${message}`);
      });
      result.chain.forEach((step, index) => {
        console.error(
          `  ${index + 1}. ${step.status} -> ${step.location} (raw: ${step.rawLocation}, request: ${step.requestUrl}, host: ${step.hostHeader ?? "-"})`,
        );
      });
    } catch (error) {
      failed = true;
      console.error(`FAIL ${testCase.name}`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("All redirect checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
