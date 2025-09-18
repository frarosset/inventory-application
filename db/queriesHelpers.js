const pool = require("./pool.js");
const awaitQueries = async (client, queries, results = []) => {
  for (const query of queries) {
    const res = await client.query(query.text, query.data ?? []);
    results.push(res.rows || []);
  }
  return results;
};

const makeTransaction = async (queries, beforeCommitCallback = null) => {
  // This assumes the queries results are not used within the queries
  const results = [];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await awaitQueries(client, queries, results);

    if (beforeCommitCallback !== null) {
      await beforeCommitCallback(client, results);
    }

    await client.query("COMMIT");

    return results;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const queryTextGetIdFromName = (table, idAlias, name, isArray) => `
  SELECT id AS ${idAlias} 
  FROM ${table} 
  WHERE name = ${isArray ? `ANY(${name}::text[])` : name}
`;

module.exports = { awaitQueries, makeTransaction, queryTextGetIdFromName };
