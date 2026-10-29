import com.mongodb.ConnectionString;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import org.bson.Document;
import org.bson.conversions.Bson;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * One-off production-safe cleanup for course_enrollments that cannot be tied to
 * any user by id, email, or studentCode.
 *
 * Dry-run is the default. Execution requires both --execute and the exact
 * --expected-count reported by a dry-run. Deleted documents are copied to a
 * timestamped MongoDB collection before deletion.
 */
public final class OrphanEnrollmentCleanup {

    private static final DateTimeFormatter BACKUP_TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
                    .withLocale(Locale.ROOT)
                    .withZone(ZoneOffset.UTC);

    private OrphanEnrollmentCleanup() {
    }

    public static void main(String[] args) {
        boolean execute = hasArg(args, "--execute");
        Integer expectedCount = intArg(args, "--expected-count=");
        if (execute && expectedCount == null) {
            throw new IllegalArgumentException("--execute requires --expected-count=<dry-run count>");
        }

        String uri = System.getenv("SPRING_DATA_MONGODB_URI");
        if (isBlank(uri)) {
            throw new IllegalStateException("SPRING_DATA_MONGODB_URI is not set");
        }
        ConnectionString connectionString = new ConnectionString(uri);
        String databaseName = connectionString.getDatabase();
        if (isBlank(databaseName)) {
            throw new IllegalStateException("MongoDB URI must include a database name");
        }

        try (MongoClient client = MongoClients.create(connectionString)) {
            MongoDatabase database = client.getDatabase(databaseName);
            MongoCollection<Document> users = database.getCollection("users");
            MongoCollection<Document> enrollments = database.getCollection("course_enrollments");

            UserKeys userKeys = loadUserKeys(users);
            List<Document> orphans = findOrphans(enrollments, userKeys);

            System.out.printf(
                    "database=%s users=%d enrollments=%d orphanEnrollments=%d mode=%s%n",
                    databaseName,
                    users.countDocuments(),
                    enrollments.countDocuments(),
                    orphans.size(),
                    execute ? "execute" : "dry-run"
            );
            orphans.forEach(OrphanEnrollmentCleanup::printSanitized);

            if (!execute) {
                System.out.println("No records changed. Re-run with --execute --expected-count=" + orphans.size());
                return;
            }
            if (orphans.size() != expectedCount) {
                throw new IllegalStateException(
                        "Orphan count changed: expected " + expectedCount + " but found " + orphans.size()
                );
            }
            if (orphans.isEmpty()) {
                System.out.println("Nothing to delete.");
                return;
            }

            String backupCollectionName = "course_enrollments_orphan_backup_"
                    + BACKUP_TIMESTAMP.format(Instant.now());
            MongoCollection<Document> backup = database.getCollection(backupCollectionName);
            backup.insertMany(orphans.stream().map(Document::new).toList());
            long backupCount = backup.countDocuments();
            if (backupCount != orphans.size()) {
                throw new IllegalStateException(
                        "Backup verification failed: expected " + orphans.size() + " but copied " + backupCount
                );
            }

            List<Object> ids = orphans.stream().map(document -> document.get("_id")).toList();
            Bson deleteFilter = Filters.in("_id", ids);
            long deletedCount = enrollments.deleteMany(deleteFilter).getDeletedCount();
            if (deletedCount != orphans.size()) {
                throw new IllegalStateException(
                        "Delete verification failed: expected " + orphans.size() + " but deleted " + deletedCount
                );
            }

            List<Document> remainingOrphans = findOrphans(enrollments, userKeys);
            System.out.printf(
                    "deleted=%d backupCollection=%s remainingOrphans=%d remainingEnrollments=%d%n",
                    deletedCount,
                    backupCollectionName,
                    remainingOrphans.size(),
                    enrollments.countDocuments()
            );
            if (!remainingOrphans.isEmpty()) {
                throw new IllegalStateException("Cleanup finished with remaining orphan enrollments");
            }
        }
    }

    private static UserKeys loadUserKeys(MongoCollection<Document> users) {
        Set<String> ids = new HashSet<>();
        Set<String> emails = new HashSet<>();
        Set<String> studentCodes = new HashSet<>();
        for (Document user : users.find()) {
            add(ids, user.get("_id"));
            add(emails, user.get("email"));
            add(studentCodes, user.get("studentCode"));
        }
        return new UserKeys(ids, emails, studentCodes);
    }

    private static List<Document> findOrphans(
            MongoCollection<Document> enrollments,
            UserKeys users
    ) {
        List<Document> orphans = new ArrayList<>();
        for (Document enrollment : enrollments.find()) {
            String studentId = normalize(enrollment.get("studentId"));
            String studentEmail = normalize(enrollment.get("studentEmail"));
            String studentCode = normalize(enrollment.get("studentCode"));
            boolean matched = users.ids().contains(studentId)
                    || users.emails().contains(studentId)
                    || users.studentCodes().contains(studentId)
                    || users.emails().contains(studentEmail)
                    || users.studentCodes().contains(studentCode);
            if (!matched) {
                orphans.add(enrollment);
            }
        }
        return orphans;
    }

    private static void printSanitized(Document enrollment) {
        String id = String.valueOf(enrollment.get("_id"));
        String idPrefix = id.substring(0, Math.min(8, id.length()));
        System.out.printf(
                "orphan idPrefix=%s studentId=%s studentCode=%s name=%s email=%s course=%s class=%s%n",
                idPrefix,
                safe(enrollment.get("studentId")),
                safe(enrollment.get("studentCode")),
                safe(enrollment.get("studentName")),
                maskEmail(enrollment.getString("studentEmail")),
                safe(enrollment.get("courseId")),
                safe(enrollment.get("classId"))
        );
    }

    private static String maskEmail(String email) {
        if (isBlank(email)) {
            return "<missing>";
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "<invalid>";
        }
        String local = email.substring(0, at);
        String visible = local.substring(0, Math.min(2, local.length()));
        return visible + "***" + email.substring(at);
    }

    private static String safe(Object value) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isEmpty() ? "<missing>" : text.replaceAll("[\\r\\n\\t]", " ");
    }

    private static void add(Set<String> values, Object value) {
        String normalized = normalize(value);
        if (!normalized.isEmpty()) {
            values.add(normalized);
        }
    }

    private static String normalize(Object value) {
        return value == null ? "" : String.valueOf(value).trim().toLowerCase(Locale.ROOT);
    }

    private static boolean hasArg(String[] args, String expected) {
        for (String arg : args) {
            if (expected.equals(arg)) {
                return true;
            }
        }
        return false;
    }

    private static Integer intArg(String[] args, String prefix) {
        for (String arg : args) {
            if (arg.startsWith(prefix)) {
                return Integer.parseInt(arg.substring(prefix.length()));
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record UserKeys(Set<String> ids, Set<String> emails, Set<String> studentCodes) {
    }
}
