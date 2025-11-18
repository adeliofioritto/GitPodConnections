
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const { Client } = require('pg');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');


const NAMESPACE = process.env.NAMESPACE || 'default';
const POD_FILTER = 'cis4c-be';
const COMMAND = [
    '/wildfly/bin/jboss-cli.sh',
    '--connect',
    '--output-json',
    '--commands=/subsystem=datasources/xa-data-source=cis4c-be-pool:read-resource(include-runtime=true,recursive=true)'
];

const OC_SERVER = process.env.OC_SERVER;
const OC_USERNAME = process.env.OC_USERNAME;
const OC_PASSWORD = process.env.OC_PASSWORD;

// Configurazione PostgreSQL
const PG_HOST = process.env.PG_HOST;
const PG_PORT = process.env.PG_PORT || 5432;
const PG_USER = process.env.PG_USER;
const PG_PASSWORD = process.env.PG_PASSWORD;
const PG_DATABASE = process.env.PG_DATABASE;

const NODE_INTERVAL_CRON = process.env.NODE_INTERVAL_CRON || '*/5 * * * *';

function runCommand(cmd, args) {
    const result = spawnSync(cmd, args, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 20 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || 'Errore sconosciuto');
    return result.stdout;
}

function ocLogin() {
    console.log('Connessione a OpenShift tramite oc login...');
    runCommand('oc', ['login', OC_SERVER, '-u', OC_USERNAME, '-p', OC_PASSWORD, '--insecure-skip-tls-verify', '-n', NAMESPACE]);
}

function getPods() {
    const output = runCommand('oc', ['get', 'pods', '-n', NAMESPACE, '-o', 'json']);
    const podsJson = JSON.parse(output);
    return podsJson.items.filter(pod => pod.metadata.name.includes(POD_FILTER) && pod.status.phase === 'Running');
}

async function saveStatsToDB(podName, stats) {
    const client = new Client({ host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database: PG_DATABASE });
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS cis4c_delivery');
    await client.query(`CREATE TABLE IF NOT EXISTS cis4c_delivery.pool_stats (
        id SERIAL PRIMARY KEY,
        execution_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        namespace VARCHAR(255),
        pod_name VARCHAR(255),
        active_count INT,
        available_count INT,
        idle_count INT,
        in_use_count INT,
        max_pool_size VARCHAR(50)
    )`);
    // Inserimento record con execution_id
    const insertQuery = `INSERT INTO cis4c_delivery.pool_stats (execution_id, namespace, pod_name, active_count, available_count, idle_count, in_use_count, max_pool_size)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const values = [EXECUTION_ID, NAMESPACE, podName, stats.ActiveCount, stats.AvailableCount, stats.IdleCount, stats.InUseCount, stats.MaxPoolSize];
    await client.query(insertQuery, values);

    await client.end();
    console.log(`Statistiche salvate nel DB per ${podName}`);
}

function execCommandOnPod(podName) {
    const args = ['exec', podName, '-n', NAMESPACE, '--', ...COMMAND];
    const output = runCommand('oc', args);
    let stats = {};
    try {
        const jsonOutput = JSON.parse(output);
        const poolStats = jsonOutput.result?.statistics?.pool || {};
        stats = {
            ActiveCount: poolStats.ActiveCount || 0,
            AvailableCount: poolStats.AvailableCount || 0,
            IdleCount: poolStats.IdleCount || 0,
            InUseCount: poolStats.InUseCount || 0,
            MaxPoolSize: jsonOutput.result['max-pool-size'] || 'expression'
        };
    } catch (err) {
        console.error('Errore parsing JSON:', err.message);
    }

    console.table(stats);

    // Salva su file JSON
    /*
    const fileName = `stats_${podName}.json`;
    fs.writeFileSync(fileName, JSON.stringify(stats, null, 2));
    console.log(`Statistiche salvate in ${fileName}`);
    */
    // Salva su DB
    saveStatsToDB(podName, stats).catch(err => console.error('Errore DB:', err.message));
}

EXECUTION_ID = null;

async function job() {
    try {
        // Genera un ID univoco per questa esecuzione
        EXECUTION_ID = uuidv4();
        console.log(`Execution ID per questa run: ${EXECUTION_ID}`);

        ocLogin();
        const pods = getPods();
        if (pods.length === 0) {
            console.log('Nessun pod Running trovato');
            return;
        }
        for (const pod of pods) execCommandOnPod(pod.metadata.name);
    } catch (err) {
        console.error('Errore job:', err.message);
    }
}

const requiredVars = [
  'NAMESPACE',
  'OC_SERVER',
  'OC_USERNAME',
  'OC_PASSWORD',
  'PG_HOST',
  'PG_PORT',
  'PG_USER',
  'PG_PASSWORD',
  'PG_DATABASE',
  'NODE_INTERVAL_CRON'
];

const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`Variabili mancanti: ${missingVars.join(', ')}`);
  console.log('Il programma entrerà in sleep finché non vengono definite...');
  
  // Sleep infinito
  setInterval(() => {
    console.log('In attesa che le variabili siano definite...');
  }, 60000); // ogni 60 secondi
  return; // blocca l'esecuzione del resto
}


job();

// Schedulazione ogni 5 minuti
cron.schedule(NODE_INTERVAL_CRON, () => {
    console.log('Esecuzione job ogni 5 minuti:', new Date().toISOString());
    job();
});
