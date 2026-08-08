import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'exam_scheduler.db');
const db = new Database(dbPath);

const result = db.prepare('UPDATE students SET email = NULL').run();
console.log(`✅ Cleared emails for ${result.changes} student(s).`);

db.close();
