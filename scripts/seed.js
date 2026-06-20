// Seeds a few sample buses and pulls their challans so you can see the
// dashboard populated immediately. Run with: npm run seed
import * as store from '../src/store.js';
import { refreshAll } from '../src/services/challanService.js';

const sample = [
  { number: 'RJ14PA1234', name: 'Bus 1 - Jaipur' },
  { number: 'RJ19GB4521', name: 'Bus 2 - Jodhpur' },
  { number: 'HR55AA9090', name: 'Bus 3 - Gurgaon' },
];

for (const b of sample) {
  try {
    store.addBus(b);
    console.log('Added', b.number);
  } catch (e) {
    console.log('Skip', b.number, '-', e.message);
  }
}

const result = await refreshAll();
console.log(`Seeded challans: ${result.succeeded} bus(es) refreshed.`);
console.log('Run "npm start" and open http://localhost:3000');
