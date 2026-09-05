const fs = require('node:fs');
const path = require('node:path');

const {
  execFileSync,
} = require('node:child_process');

function walk(dir) {
  return fs
    .readdirSync(dir, {
      withFileTypes: true,
    })
    .flatMap((entry) => {
      const full = path.join(
        dir,
        entry.name
      );

      return entry.isDirectory()
        ? walk(full)
        : [full];
    });
}

const srcDir = path.join(
  __dirname,
  '..',
  'src'
);

const files = [
  path.join(
    __dirname,
    '..',
    'deploy-commands.js'
  ),
  ...walk(srcDir).filter((file) =>
    file.endsWith('.js')
  ),
];

for (const file of files) {
  execFileSync(
    process.execPath,
    ['--check', file],
    {
      stdio: 'inherit',
    }
  );
}

console.log(
  `✅ Syntax check passed for ${files.length} JavaScript files.`
);