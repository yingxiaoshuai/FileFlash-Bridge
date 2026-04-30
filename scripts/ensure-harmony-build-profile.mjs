import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const harmonyDir = path.join(repoRoot, 'harmony');
const buildProfilePath = path.join(harmonyDir, 'build-profile.json5');
const buildProfileTemplatePath = path.join(
  harmonyDir,
  'build-profile.template.json5',
);

function main() {
  if (fs.existsSync(buildProfilePath)) {
    return;
  }

  if (!fs.existsSync(buildProfileTemplatePath)) {
    throw new Error(
      `Missing Harmony build profile template: ${buildProfileTemplatePath}`,
    );
  }

  fs.copyFileSync(buildProfileTemplatePath, buildProfilePath);
  console.log(
    `Created Harmony build profile from template: ${path.relative(
      repoRoot,
      buildProfilePath,
    )}`,
  );
}

main();
