// Runs once, only when the offline Mongo volume is empty.
// Creates a least-privilege application user for the Spring Boot backend.
const dbName = process.env.MONGO_APP_DB || 'tutor_db';
const user = process.env.MONGO_APP_USERNAME;
const pwd = process.env.MONGO_APP_PASSWORD;
if (!user || !pwd) {
  throw new Error('MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required');
}
const appDb = db.getSiblingDB(dbName);
if (!appDb.getUser(user)) {
  appDb.createUser({ user, pwd, roles: [{ role: 'readWrite', db: dbName }] });
  print(`Created application user for ${dbName}`);
}
