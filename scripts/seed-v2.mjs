import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

async function loadConfig() {
  let fileEnv = {};
  try { fileEnv = readEnvFile(await fs.readFile('.env', 'utf8')); } catch { /* .env is optional when variables are exported */ }
  const env = { ...fileEnv, ...process.env };
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the seed script.');
  }
  return env;
}

const env = await loadConfig();
const seedPath = process.argv[2] || path.resolve('seed/guangzhou-family-trip-2027.json');
const source = JSON.parse(await fs.readFile(seedPath, 'utf8'));
const meta = source.meta || {};
const data = source.data || {};
const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fail = (label, result) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const currencyFor = (key) => key === 'foreign' ? (data.foreignCurrency || 'CNY') : (meta.currency || 'MYR');
const ownerId = env.SUPABASE_SEED_OWNER_ID || null;
const slug = (env.SUPABASE_SEED_SLUG || path.basename(seedPath, '.json')).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const existing = fail('Find existing trip', await client.from('trips').select('id').eq('slug', slug).maybeSingle());
if (existing?.id) fail('Delete existing v2 trip', await client.from('trips').delete().eq('id', existing.id));

const trip = fail('Create trip', await client.from('trips').insert({
  owner_id: ownerId,
  slug,
  title: meta.title || slug,
  destination: meta.destination || '',
  description: meta.description || '',
  start_date: meta.start_date || null,
  end_date: meta.end_date || null,
  home_currency: meta.currency || 'MYR',
  visibility: 'public',
}).select().single());

for (const [dayIndex, day] of (data.days || []).entries()) {
  const dayRow = fail(`Create day ${dayIndex + 1}`, await client.from('trip_days').insert({
    trip_id: trip.id,
    day_number: dayIndex + 1,
    title: day.title || `Day ${dayIndex + 1}`,
    intensity: day.intensity || 'light',
    walking_note: day.steps || '',
    map_url: day.mapUrl || '',
    notes: day.notes || '',
  }).select().single());

  for (const [activityIndex, activity] of (day.items || []).entries()) {
    const activityRow = fail(`Create activity ${dayIndex + 1}.${activityIndex + 1}`, await client.from('activities').insert({
      day_id: dayRow.id,
      sort_order: activityIndex,
      time_label: activity.t || '',
      title: activity.x || '',
      transport_note: activity.move || '',
      fee_note: activity.fee || '',
    }).select().single());
    const links = (activity.link || []).filter((link) => link.url).map((link, linkIndex) => ({
      activity_id: activityRow.id,
      label: link.label || link.url,
      url: link.url,
      sort_order: linkIndex,
    }));
    if (links.length) fail(`Create activity links ${dayIndex + 1}.${activityIndex + 1}`, await client.from('activity_links').insert(links));
  }
}

const checklist = (data.checklist || []).map((item, index) => ({
  trip_id: trip.id, text: item.text || '', is_done: item.done === true, sort_order: index, created_by: ownerId,
}));
if (checklist.length) fail('Create checklist', await client.from('checklist_items').insert(checklist));

const packing = (data.packing || []).map((item, index) => ({
  trip_id: trip.id, category: item.category || '其他', text: item.text || '', is_done: item.done === true, sort_order: index,
}));
if (packing.length) fail('Create packing list', await client.from('packing_items').insert(packing));

for (const [index, hotel] of (data.hotels || []).entries()) {
  const hotelRow = fail(`Create accommodation ${index + 1}`, await client.from('accommodations').insert({
    trip_id: trip.id, sort_order: index, rank_label: hotel.rank || '', name: hotel.name || '',
    address: hotel.addr || '', warning: hotel.warn || '', pros_cons: hotel.pointsText || '', notes: hotel.notes || '',
  }).select().single());
  const links = (hotel.link || []).filter((link) => link.url).map((link, linkIndex) => ({
    accommodation_id: hotelRow.id, label: link.label || link.url, url: link.url, sort_order: linkIndex,
  }));
  if (links.length) fail(`Create accommodation links ${index + 1}`, await client.from('accommodation_links').insert(links));
}

const transport = (data.transport || []).map((item, index) => ({
  trip_id: trip.id, sort_order: index, type: item.type || '', description: item.description || '',
  price_label: item.price || '', amount: item.amount === '' ? null : Number(item.amount), currency_code: currencyFor(item.currency),
}));
if (transport.length) fail('Create transport options', await client.from('transport_options').insert(transport));

const budget = (data.budget || []).map((item, index) => ({
  trip_id: trip.id, sort_order: index, category: item.category || '', unit: item.unit || '',
  quantity: Number(item.quantity) || 0, unit_price: Number(item.unitPrice) || 0,
  currency_code: currencyFor(item.currency), note: item.note || '',
}));
if (budget.length) fail('Create budget items', await client.from('budget_items').insert(budget));

const notes = (data.notes || []).map((item) => ({
  trip_id: trip.id, author_id: ownerId, author_name: item.author || '', content: item.text || '', created_at: item.ts || undefined,
}));
if (notes.length) fail('Create trip notes', await client.from('trip_notes').insert(notes));

console.log(`Imported ${meta.title || slug}`);
console.log(`Trip slug: ${slug}`);
console.log(`Trip id: ${trip.id}`);
console.log('Owner: ' + (ownerId || 'none; set SUPABASE_SEED_OWNER_ID to attach an Auth user'));
