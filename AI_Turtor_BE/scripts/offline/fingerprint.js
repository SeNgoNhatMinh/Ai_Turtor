// READ-ONLY fingerprint of a database: per collection count, index specs and a
// SHA-256 over canonical Extended JSON of every document sorted by _id.
// Canonical EJSON keeps BSON types distinct (Int32/Int64/Double/Date/ObjectId/Binary).
const crypto = require('crypto');
const t = db.getSiblingDB(process.env.DBNAME || 'tutor_db');
const out = {};
for (const name of t.getCollectionNames().sort()) {
  const c = t.getCollection(name);
  const h = crypto.createHash('sha256');
  let n = 0;
  c.find().sort({ _id: 1 }).forEach(d => { h.update(EJSON.stringify(d, { relaxed: false })); h.update('\n'); n++; });
  const idx = c.getIndexes().map(i => {
    const { v, ns, ...rest } = i; return JSON.stringify(rest);
  }).sort();
  const info = t.getCollectionInfos({ name })[0];
  out[name] = { count: n, sha256: h.digest('hex'), indexes: idx, validator: !!(info.options && info.options.validator) };
}
print(JSON.stringify(out));
