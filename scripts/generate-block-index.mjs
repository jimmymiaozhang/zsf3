import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, 'public', 'data');
const blockFilePattern = /^block_.*_envelopes\.json$/i;
const lotRequirementsPattern = /^(\d+)_.*\.json$/i;

async function collectDirectories(rootDirectory) {
  const directories = [rootDirectory];
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childDirectory = path.join(rootDirectory, entry.name);
    const childDirectories = await collectDirectories(childDirectory);
    directories.push(...childDirectories);
  }

  return directories;
}

function toPublicUrl(absolutePath) {
  const relativePath = path.relative(path.join(projectRoot, 'public'), absolutePath);
  return `/${relativePath.split(path.sep).join('/')}`;
}

async function writeIndexForDirectory(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const blockFiles = entries
    .filter((entry) => entry.isFile() && blockFilePattern.test(entry.name))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (!blockFiles.length) {
    return false;
  }

  const lotZoningRequirements = {};
  const directories = await collectDirectories(directoryPath);

  for (const currentDirectory of directories) {
    const childEntries = await fs.readdir(currentDirectory, { withFileTypes: true });

    for (const entry of childEntries) {
      if (!entry.isFile()) {
        continue;
      }

      const match = entry.name.match(lotRequirementsPattern);
      if (!match) {
        continue;
      }

      const bbl = match[1];
      if (!bbl) {
        continue;
      }

      lotZoningRequirements[bbl] = toPublicUrl(
        path.join(currentDirectory, entry.name)
      );
    }
  }

  const indexPath = path.join(directoryPath, 'index.json');
  const indexContents = JSON.stringify(
    {
      blocks: blockFiles.map(toPublicUrl),
      lotZoningRequirements,
    },
    null,
    2
  );

  await fs.writeFile(indexPath, `${indexContents}\n`, 'utf8');
  return true;
}

async function main() {
  const directories = await collectDirectories(dataRoot);
  let updatedCount = 0;

  for (const directoryPath of directories) {
    const wroteIndex = await writeIndexForDirectory(directoryPath);
    if (wroteIndex) {
      updatedCount += 1;
    }
  }

  console.log(`Generated block indexes in ${updatedCount} folder(s).`);
}

main().catch((error) => {
  console.error('Failed to generate block indexes.');
  console.error(error);
  process.exit(1);
});
