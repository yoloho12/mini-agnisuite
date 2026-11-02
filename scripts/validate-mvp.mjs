import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'next.config.ts',
  'tsconfig.json',
  'src/app/(dashboard)/page.tsx',
  'src/app/actions/productActions.ts',
  'src/app/actions/warehouseActions.ts',
  'src/app/actions/siteActions.ts',
  'src/types/index.ts',
];

const warnings = [];
const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_JWKS_URL',
];

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  warnings.push(`Node ${process.version} is below the recommended 20.x for this project.`);
}

for (const file of requiredFiles) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    warnings.push(`Missing required file: ${file}`);
  }
}

const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  for (const key of requiredEnv) {
    if (!env.includes(`${key}=`)) {
      warnings.push(`Missing ${key} in .env.local`);
    }
  }
} else {
  warnings.push('Missing .env.local; local startup may require environment variables.');
}

const srcDir = path.join(root, 'src');
if (!fs.existsSync(srcDir)) {
  warnings.push('Missing src folder.');
}

const appDir = path.join(root, 'src/app');
if (!fs.existsSync(appDir)) {
  warnings.push('Missing src/app folder.');
}

console.log('Mini-AgniSuite MVP check');
console.log('========================');
console.log(`Root: ${root}`);
console.log(`Node: ${process.version}`);
console.log(`Check result: ${warnings.length === 0 ? 'READY' : 'WARNINGS FOUND'}`);

if (warnings.length === 0) {
  console.log('Core MVP files and expected structure are present.');
} else {
  console.log('');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  console.log('');
  console.log('You can still continue development, but the app may need environment values or setup before full runtime validation.');
}

if (warnings.length > 0) {
  process.exitCode = 1;
}
