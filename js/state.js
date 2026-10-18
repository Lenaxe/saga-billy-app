import { db } from './db.js';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function defaultState() {
  return {
    character: {
      caractere: '',
      classeItems: [],
      primary: {
        habilite: { base: 2, bonus: 0 },
        adresse: { base: 1, bonus: 0, cap: 5 },
        endurance: { base: 2, bonus: 0 },
        chance: { base: 3, bonus: 0 }
      },
      secondary: {
        degats: 0,
        armure: 0,
        critique: 0,
        pvMaxBase: 0,
        pvMaxBonus: 0
      },
      suiviPV: 0,
      suiviChance: 0,
      materiel: [],
      objetsRecuperes: [],
      gloire: 0,
      gloireMax: 15,
      richesse: 0,
      richesseMax: 15,
      keywords: [],
      notesAventure: ''
    },
    combat: {
      enemyName: '',
      enemyStats: [],
      formula: '',
      log: []
    },
    dice: {
      count: 1,
      type: 6,
      modifier: 0,
      history: []
    },
    notes: {
      free: '',
      rules: ''
    }
  };
}

let state = defaultState();
let autosaveTimer = null;
let listeners = [];

export async function loadState() {
  const saved = await db.getMeta('currentState');
  state = saved ? mergeDefaults(defaultState(), saved) : defaultState();
  return state;
}

function mergeDefaults(def, saved) {
  const out = { ...def };
  for (const key of Object.keys(def)) {
    if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key])) {
      out[key] = { ...def[key], ...saved[key] };
    } else if (saved[key] !== undefined) {
      out[key] = saved[key];
    }
  }
  return out;
}

export function getState() {
  return state;
}

export function setState(newState) {
  state = newState;
  scheduleAutosave();
  notify();
}

export function onChange(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach(fn => fn(state));
}

export function touch() {
  scheduleAutosave();
  notify();
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    db.setMeta('currentState', state);
  }, 400);
}

export function flushAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  return db.setMeta('currentState', state);
}

export async function saveToSlot(slotId, name) {
  await flushAutosave();
  const snapshot = JSON.parse(JSON.stringify(state));
  await db.putSave({ slotId, name, timestamp: Date.now(), state: snapshot });
}

export async function loadFromSlot(slotId) {
  const row = await db.getSave(slotId);
  if (!row) return false;
  state = mergeDefaults(defaultState(), row.state);
  await flushAutosave();
  notify();
  return true;
}

export async function listSaves() {
  const all = await db.getAllSaves();
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteSaveSlot(slotId) {
  await db.deleteSave(slotId);
}

export async function exportAll() {
  await flushAutosave();
  const saves = await db.getAllSaves();
  return {
    exportedAt: Date.now(),
    version: 2,
    state,
    saves
  };
}

export async function importAll(data) {
  if (!data || !data.state) throw new Error('Fichier invalide');
  await db.clearAll();
  state = mergeDefaults(defaultState(), data.state);
  await flushAutosave();
  for (const save of (data.saves || [])) {
    await db.putSave(save);
  }
  notify();
}
