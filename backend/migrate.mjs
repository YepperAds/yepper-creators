import fs from 'fs/promises';
import dotenv from 'dotenv';
import { query } from './db.js';

dotenv.config();

async function main(){
  const sqlPath = new URL('../db/schema.sql', import.meta.url);
  const sql = await fs.readFile(sqlPath, 'utf8').catch(() => null);
  if(!sql){
    console.error('Could not read db/schema.sql');
    process.exit(1);
  }

  try{
    await query(sql);
    console.log('Migration applied successfully.');
    process.exit(0);
  }catch(err){
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
