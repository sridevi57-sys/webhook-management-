import dotenv from 'dotenv';

dotenv.config();

console.log('Starting Webhook Worker...');

// Worker logic will be implemented here on Day 3 and 4
setInterval(() => {
  console.log('Worker is listening for queued jobs...');
}, 60000);
