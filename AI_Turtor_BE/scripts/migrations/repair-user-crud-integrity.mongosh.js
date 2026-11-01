/*
 * Safe repair for legacy CRUD inconsistencies.
 *
 * Default mode is DRY RUN. Nothing is written unless APPLY_CHANGES=true.
 * Run after mongodump/Atlas snapshot and while CRUD writes are paused:
 *
 *   mongosh "$MONGODB_URI" --file scripts/migrations/repair-user-crud-integrity.mongosh.js
 *   $env:APPLY_CHANGES='true'; mongosh "$env:MONGODB_URI" --file scripts/migrations/repair-user-crud-integrity.mongosh.js
 *
 * Scope intentionally excludes courses, class_sections, enrollments,
 * assignments, submissions, quizzes, course materials content and vectors.
 */

const APPLY_CHANGES = String(process.env.APPLY_CHANGES || "false").toLowerCase() === "true";
const DB_NAME = process.env.MONGODB_DATABASE || "tutor_db";
const database = db.getSiblingDB(DB_NAME);
const now = new Date();

function ids(collection, query) {
  return database.getCollection(collection)
    .find(query, { _id: 1 })
    .limit(10000)
    .toArray()
    .map((item) => item._id);
}

function report(name, collection, query) {
  const matchingIds = ids(collection, query);
  print(`${name}: ${matchingIds.length}`);
  if (matchingIds.length > 0) {
    printjson(matchingIds.slice(0, 20));
  }
  return matchingIds;
}

function updateMany(name, collection, query, update) {
  const matchingIds = report(name, collection, query);
  if (!APPLY_CHANGES || matchingIds.length === 0) {
    return;
  }
  const result = database.getCollection(collection).updateMany(query, update);
  print(`${name} updated: ${result.modifiedCount}`);
}

print(`Database: ${DB_NAME}`);
print(`Mode: ${APPLY_CHANGES ? "APPLY" : "DRY_RUN"}`);
print("Protected learning collections are not deleted or rewritten by this migration.");

const userIds = new Set(database.users.find({}, { _id: 1 }).toArray().map((item) => String(item._id)));
const conversationIds = new Set(database.ai_conversations.find({}, { _id: 1 }).toArray().map((item) => String(item._id)));
const adminIds = database.users
  .find({ role: "ADMIN" }, { _id: 1 })
  .toArray()
  .map((item) => item._id);

const orphanTicketIds = database.question_escalations
  .find({}, { _id: 1, userId: 1 })
  .toArray()
  .filter((item) => item.userId && !userIds.has(String(item.userId)))
  .map((item) => item._id);
print(`tickets with missing user: ${orphanTicketIds.length}`);
if (orphanTicketIds.length > 0) printjson(orphanTicketIds.slice(0, 20));
if (APPLY_CHANGES && orphanTicketIds.length > 0) {
  database.question_escalations.updateMany(
    { _id: { $in: orphanTicketIds } },
    { $set: { integrityStatus: "ORPHANED_USER_REFERENCE", integrityCheckedAt: now, updatedAt: now } }
  );
}

function detachMissingConversation(collection) {
  const dangling = database.getCollection(collection)
    .find({ conversationId: { $exists: true, $nin: [null, ""] } }, { _id: 1, conversationId: 1 })
    .toArray()
    .filter((item) => !conversationIds.has(String(item.conversationId)))
    .map((item) => item._id);
  print(`${collection} with missing conversation: ${dangling.length}`);
  if (dangling.length > 0) printjson(dangling.slice(0, 20));
  if (APPLY_CHANGES && dangling.length > 0) {
    database.getCollection(collection).updateMany(
      { _id: { $in: dangling } },
      {
        $unset: { conversationId: "" },
        $set: {
          conversationDeletedAt: now,
          integrityStatus: "DETACHED_MISSING_CONVERSATION",
          integrityCheckedAt: now,
          updatedAt: now
        }
      }
    );
  }
}

detachMissingConversation("question_escalations");
detachMissingConversation("ai_answer_reviews");
detachMissingConversation("harness_logs");

if (adminIds.length > 0) {
  report(
    "admin-owned active chats requiring manual closure",
    "question_escalations",
    { userId: { $in: adminIds }, status: "IN_CHAT", hiddenFromAdminAt: { $exists: false } }
  );
  updateMany(
    "admin-owned student tickets to quarantine",
    "question_escalations",
    {
      userId: { $in: adminIds },
      status: { $ne: "IN_CHAT" },
      hiddenFromAdminAt: { $exists: false },
      $or: [
        { chatRoomId: { $exists: false } },
        { chatRoomId: { $in: [null, ""] } },
        { status: { $regex: /^(COMPLETED|CANCELLED|RESOLVED|ANSWERED)/i } }
      ]
    },
    {
      $unset: { idempotencyKey: "" },
      $set: {
        status: "CANCELLED",
        cancelReason: "ADMIN_ACCOUNT_CANNOT_OWN_STUDENT_TICKET",
        hiddenFromMentorInboxAt: now,
        hiddenFromAdminAt: now,
        hiddenFromAdminBy: "DATA_INTEGRITY_MIGRATION",
        updatedAt: now
      }
    }
  );
}

const missingMaterialCandidates = database.knowledge_candidates
  .find({ status: "INDEXED", $or: [{ materialId: null }, { materialId: { $exists: false } }] })
  .toArray();
print(`INDEXED candidates without materialId: ${missingMaterialCandidates.length}`);
for (const candidate of missingMaterialCandidates) {
  const materials = database.course_materials.find({
    knowledgeCandidateId: candidate._id,
    indexingStatus: "INDEXED"
  }, { _id: 1 }).toArray();
  print(`candidate ${candidate._id}: ${materials.length} indexed material match(es)`);
  if (APPLY_CHANGES && materials.length === 1) {
    database.knowledge_candidates.updateOne(
      { _id: candidate._id, status: "INDEXED", $or: [{ materialId: null }, { materialId: { $exists: false } }] },
      { $set: { materialId: materials[0]._id, updatedAt: now, integrityCheckedAt: now } }
    );
  } else if (APPLY_CHANGES && materials.length !== 1) {
    database.knowledge_candidates.updateOne(
      { _id: candidate._id },
      { $set: { integrityStatus: "MATERIAL_LINK_REQUIRES_REVIEW", integrityCheckedAt: now, updatedAt: now } }
    );
  }
}

const duplicateMaterialGroups = database.course_materials.aggregate([
  { $match: { knowledgeCandidateId: { $exists: true, $nin: [null, ""] } } },
  { $group: { _id: "$knowledgeCandidateId", materialIds: { $push: "$_id" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
print(`knowledge candidates with duplicate materials: ${duplicateMaterialGroups.length}`);
for (const group of duplicateMaterialGroups) printjson(group);
print("Duplicate materials are report-only: deleting them also requires coordinated vector-index cleanup.");

print(APPLY_CHANGES
  ? "Repair finished. Re-run in DRY_RUN mode and execute the smoke-test checklist."
  : "Dry run finished. Review every listed id, take a backup, then set APPLY_CHANGES=true.");
