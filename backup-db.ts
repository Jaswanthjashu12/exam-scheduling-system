import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'exam_scheduler.db');
const backupPath = path.join(dbDir, 'exam_scheduler_backup.db');

console.log(`Connecting to source database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database file not found at ${dbPath}`);
  process.exit(1);
}

try {
  // Open the database (readonly is safer to avoid modifying state)
  const db = new Database(dbPath, { readonly: true });

  console.log('Starting SQLite backup process...');
  console.log('This will safely checkpoint WAL journal logs and write them into a single-file backup.');

  db.backup(backupPath)
    .then(() => {
      console.log('\n==================================================');
      console.log('🎉 Database Backup Created Successfully!');
      console.log(`Location: ${backupPath}`);
      console.log('==================================================');
      console.log('\nThis backup file:');
      console.log('1. Contains all the latest tables and entries.');
      console.log('2. Has all WAL log data fully merged and checkpointed.');
      console.log('3. Is completely unlocked and safe to copy/upload.');
      console.log('\nYou can now drag and drop or open this file in https://sqliteonline.com/ without any SQLITE_CANTOPEN errors.');
      db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed during execution:', err);
      db.close();
      process.exit(1);
    });
} catch (err) {
  console.error('Failed to open database connection:', err);
  process.exit(1);
}
