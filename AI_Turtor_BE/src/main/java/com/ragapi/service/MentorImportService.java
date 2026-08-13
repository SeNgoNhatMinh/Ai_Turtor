package com.ragapi.service;

import com.ragapi.dto.MentorImportResponse;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.User;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@AllArgsConstructor
public class MentorImportService {

    private static final List<String> TEMPLATE_HEADERS = List.of(
            "Code",
            "Name",
            "Email",
            "Phone",
            "Classes"
    );

    private static final List<List<String>> SAMPLE_ROWS = List.of(
            List.of("GV001", "Teacher A", "teacher.a@university.edu", "0900000001", "SE1840;SE1841")
    );

    private final MentorRepository mentorRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DataFormatter dataFormatter = new DataFormatter();

    public MentorImportResponse importMentorsFromExcel(MultipartFile file, boolean dryRun) {
        MentorImportResponse response = new MentorImportResponse();
        List<String> successMessages = new ArrayList<>();
        List<String> errorMessages = new ArrayList<>();
        List<Mentor> mentorsToSave = new ArrayList<>();
        List<User> usersToSave = new ArrayList<>();
        Set<String> emailsInFile = new HashSet<>();
        Set<String> codesInFile = new HashSet<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int totalRows = 0;
            int successCount = 0;
            int errorCount = 0;

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isEmptyRow(row)) {
                    continue;
                }

                totalRows++;
                try {
                    Mentor mentor = parseMentorFromRow(row);
                    String validationError = validateMentor(mentor);
                    if (validationError != null) {
                        errorMessages.add("Row " + (i + 1) + ": " + validationError);
                        errorCount++;
                        continue;
                    }

                    String emailKey = mentor.getEmail().trim().toLowerCase();
                    String codeKey = mentor.getMentorCode().trim().toLowerCase();
                    if (!emailsInFile.add(emailKey)) {
                        errorMessages.add("Row " + (i + 1) + ": duplicate email in file: " + mentor.getEmail());
                        errorCount++;
                        continue;
                    }
                    if (!codesInFile.add(codeKey)) {
                        errorMessages.add("Row " + (i + 1) + ": duplicate teacher code in file: " + mentor.getMentorCode());
                        errorCount++;
                        continue;
                    }
                    if (mentorRepository.findByEmail(mentor.getEmail()).isPresent()) {
                        errorMessages.add("Row " + (i + 1) + ": email already exists: " + mentor.getEmail());
                        errorCount++;
                        continue;
                    }
                    if (mentorRepository.findByMentorCode(mentor.getMentorCode()).isPresent()) {
                        errorMessages.add("Row " + (i + 1) + ": teacher code already exists: " + mentor.getMentorCode());
                        errorCount++;
                        continue;
                    }

                    mentorsToSave.add(mentor);
                    syncImportedMentorAccount(usersToSave, mentor);
                    successMessages.add("Row " + (i + 1) + ": " + mentor.getMentorName() + " - OK");
                    successCount++;
                } catch (Exception e) {
                    errorMessages.add("Row " + (i + 1) + ": parse error - " + e.getMessage());
                    errorCount++;
                }
            }

            if (!dryRun && errorCount == 0 && !mentorsToSave.isEmpty()) {
                mentorRepository.saveAll(mentorsToSave);
                if (!usersToSave.isEmpty()) {
                    userRepository.saveAll(usersToSave);
                }
                log.info("Imported {} teachers successfully and synced {} mentor user accounts", successCount, usersToSave.size());
            }

            response.setSuccess(errorCount == 0);
            response.setTotalRows(totalRows);
            response.setSuccessCount(successCount);
            response.setErrorCount(errorCount);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(errorMessages);
            response.setMessage("Teacher import completed: " + successCount + " success, " + errorCount + " errors, " + totalRows + " total");
            response.setDryRun(dryRun);
        } catch (Exception e) {
            log.error("Error reading teacher import file", e);
            response.setSuccess(false);
            response.setTotalRows(0);
            response.setSuccessCount(0);
            response.setErrorCount(1);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(List.of("Excel file is invalid or corrupted: " + e.getMessage()));
            response.setMessage("Error reading Excel file");
            response.setDryRun(dryRun);
        }

        return response;
    }

    private void syncImportedMentorAccount(List<User> usersToSave, Mentor mentor) {
        LocalDateTime now = LocalDateTime.now();
        String email = mentor.getEmail().trim();
        String defaultPassword = mentor.getPhone().trim();

        User user = userRepository.findByEmail(email)
                .orElseGet(() -> User.builder()
                        .id(mentor.getId())
                        .email(email)
                        .password(passwordEncoder.encode(defaultPassword))
                        .role("TEACHER")
                        .isEmailVerified(true)
                        .emailVerifiedAt(now)
                        .createdAt(now)
                        .build());

        user.setEmail(email);
        user.setFullName(mentor.getMentorName());
        user.setPhone(mentor.getPhone());
        user.setRole("TEACHER");
        user.setIsActive(true);
        user.setIsEmailVerified(true);
        if (user.getEmailVerifiedAt() == null) {
            user.setEmailVerifiedAt(now);
        }
        if (user.getCreatedAt() == null) {
            user.setCreatedAt(now);
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(defaultPassword));
        } else if (!user.getPassword().startsWith("$2")) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        user.setUpdatedAt(now);
        usersToSave.add(user);
    }

    public MentorImportResponse importMentorsFromCsv(MultipartFile file, boolean dryRun) {
        MentorImportResponse response = new MentorImportResponse();
        List<String> successMessages = new ArrayList<>();
        List<String> errorMessages = new ArrayList<>();
        List<Mentor> mentorsToSave = new ArrayList<>();
        List<User> usersToSave = new ArrayList<>();
        Set<String> emailsInFile = new HashSet<>();
        Set<String> codesInFile = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) {
                throw new IllegalArgumentException("CSV file is empty");
            }

            int totalRows = 0;
            int successCount = 0;
            int errorCount = 0;
            String line;
            int lineNumber = 1;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank()) {
                    continue;
                }
                totalRows++;
                try {
                    Mentor mentor = parseMentorFromCsvValues(parseCsvLine(line));
                    String validationError = validateMentor(mentor);
                    if (validationError != null) {
                        errorMessages.add("Row " + lineNumber + ": " + validationError);
                        errorCount++;
                        continue;
                    }

                    String emailKey = mentor.getEmail().trim().toLowerCase();
                    String codeKey = mentor.getMentorCode().trim().toLowerCase();
                    if (!emailsInFile.add(emailKey)) {
                        errorMessages.add("Row " + lineNumber + ": duplicate email in file: " + mentor.getEmail());
                        errorCount++;
                        continue;
                    }
                    if (!codesInFile.add(codeKey)) {
                        errorMessages.add("Row " + lineNumber + ": duplicate teacher code in file: " + mentor.getMentorCode());
                        errorCount++;
                        continue;
                    }
                    if (mentorRepository.findByEmail(mentor.getEmail()).isPresent()) {
                        errorMessages.add("Row " + lineNumber + ": email already exists: " + mentor.getEmail());
                        errorCount++;
                        continue;
                    }
                    if (mentorRepository.findByMentorCode(mentor.getMentorCode()).isPresent()) {
                        errorMessages.add("Row " + lineNumber + ": teacher code already exists: " + mentor.getMentorCode());
                        errorCount++;
                        continue;
                    }

                    mentorsToSave.add(mentor);
                    syncImportedMentorAccount(usersToSave, mentor);
                    successMessages.add("Row " + lineNumber + ": " + mentor.getMentorName() + " - OK");
                    successCount++;
                } catch (Exception e) {
                    errorMessages.add("Row " + lineNumber + ": parse error - " + e.getMessage());
                    errorCount++;
                }
            }

            if (!dryRun && errorCount == 0 && !mentorsToSave.isEmpty()) {
                mentorRepository.saveAll(mentorsToSave);
                if (!usersToSave.isEmpty()) {
                    userRepository.saveAll(usersToSave);
                }
                log.info("Imported {} teachers from CSV and synced {} teacher accounts", successCount, usersToSave.size());
            }

            response.setSuccess(errorCount == 0);
            response.setTotalRows(totalRows);
            response.setSuccessCount(successCount);
            response.setErrorCount(errorCount);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(errorMessages);
            response.setMessage("Teacher CSV import completed: " + successCount + " success, " + errorCount + " errors, " + totalRows + " total");
            response.setDryRun(dryRun);
        } catch (Exception e) {
            log.error("Error reading teacher CSV import file", e);
            response.setSuccess(false);
            response.setTotalRows(0);
            response.setSuccessCount(0);
            response.setErrorCount(1);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(List.of("CSV file is invalid or corrupted: " + e.getMessage()));
            response.setMessage("Error reading CSV file");
            response.setDryRun(dryRun);
        }

        return response;
    }

    public byte[] buildTemplateCsv() {
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", TEMPLATE_HEADERS)).append("\n");
        for (List<String> row : SAMPLE_ROWS) {
            csv.append(row.stream().map(this::escapeCsv).collect(Collectors.joining(","))).append("\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    public byte[] buildTemplateWorkbook() throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Teachers");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(TEMPLATE_HEADERS.get(i));
                cell.setCellStyle(headerStyle);
            }

            for (int rowIndex = 0; rowIndex < SAMPLE_ROWS.size(); rowIndex++) {
                Row row = sheet.createRow(rowIndex + 1);
                List<String> sample = SAMPLE_ROWS.get(rowIndex);
                for (int col = 0; col < sample.size(); col++) {
                    row.createCell(col).setCellValue(sample.get(col));
                }
            }

            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    public Map<String, String> getTemplateColumns() {
        Map<String, String> columns = new LinkedHashMap<>();
        for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
            columns.put(String.valueOf((char) ('A' + i)), TEMPLATE_HEADERS.get(i));
        }
        return columns;
    }

    private Mentor parseMentorFromCsvValues(List<String> values) {
        Mentor mentor = new Mentor();
        mentor.setId(UUID.randomUUID().toString());
        mentor.setMentorCode(getCsvValue(values, 0));
        mentor.setMentorName(getCsvValue(values, 1));
        mentor.setEmail(getCsvValue(values, 2));
        mentor.setPhone(getCsvValue(values, 3));
        mentor.setTeachingClassIds(splitList(getCsvValue(values, 4)));
        mentor.setManagedCourseIds(List.of());
        mentor.setSpecializations(List.of("Teaching"));
        mentor.setCategories(List.of("Teacher"));
        mentor.setExperienceYears(0);
        mentor.setAverageRating(0.0);
        mentor.setCompletedMentorSessions(0);
        mentor.setResponseTimeMinutes(10);
        mentor.setMaxConcurrentChats(5);
        mentor.setIsActive(true);
        mentor.setKeywords(generateKeywords(mentor));
        mentor.setCurrentActiveChatSessions(0);
        mentor.setTotalHoursSpent(0);
        mentor.setVerified(true);
        mentor.setCreatedAt(LocalDateTime.now());
        mentor.setUpdatedAt(LocalDateTime.now());
        mentor.setCreatedBy("ADMIN_IMPORT_CSV");
        return mentor;
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        values.add(current.toString().trim());
        return values;
    }

    private String getCsvValue(List<String> values, int index) {
        return index < values.size() ? values.get(index).trim() : "";
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        boolean mustQuote = value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains(";");
        String escaped = value.replace("\"", "\"\"");
        return mustQuote ? "\"" + escaped + "\"" : escaped;
    }
    private Mentor parseMentorFromRow(Row row) {
        Mentor mentor = new Mentor();
        mentor.setId(UUID.randomUUID().toString());
        mentor.setMentorCode(getCellValue(row, 0));
        mentor.setMentorName(getCellValue(row, 1));
        mentor.setEmail(getCellValue(row, 2));
        mentor.setPhone(getCellValue(row, 3));
        mentor.setTeachingClassIds(splitList(getCellValue(row, 4)));
        mentor.setManagedCourseIds(List.of());
        mentor.setSpecializations(List.of("Teaching"));
        mentor.setCategories(List.of("Teacher"));
        mentor.setExperienceYears(0);
        mentor.setAverageRating(0.0);
        mentor.setCompletedMentorSessions(0);
        mentor.setResponseTimeMinutes(10);
        mentor.setMaxConcurrentChats(5);
        mentor.setIsActive(true);
        mentor.setKeywords(generateKeywords(mentor));
        mentor.setCurrentActiveChatSessions(0);
        mentor.setTotalHoursSpent(0);
        mentor.setVerified(true);
        mentor.setCreatedAt(LocalDateTime.now());
        mentor.setUpdatedAt(LocalDateTime.now());
        mentor.setCreatedBy("ADMIN_IMPORT");
        return mentor;
    }

    private String validateMentor(Mentor mentor) {
        if (isBlank(mentor.getMentorCode())) return "Teacher Code must not be blank";
        if (isBlank(mentor.getMentorName())) return "Teacher Name must not be blank";
        if (isBlank(mentor.getEmail())) return "Email must not be blank";
        if (!mentor.getEmail().matches("^[A-Za-z0-9+_.-]+@(.+)$")) return "Email is invalid: " + mentor.getEmail();
        if (isBlank(mentor.getPhone())) return "Phone must not be blank";
        if (mentor.getTeachingClassIds() == null || mentor.getTeachingClassIds().isEmpty()) return "Teaching Classes must not be blank";
        return null;
    }

    private List<String> splitList(String value) {
        if (isBlank(value)) return List.of();
        return Arrays.stream(value.split("[,;]"))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .collect(Collectors.toList());
    }

    private List<String> generateKeywords(Mentor mentor) {
        Set<String> keywords = new HashSet<>();
        if (mentor.getTeachingClassIds() != null) keywords.addAll(mentor.getTeachingClassIds());
        if (!isBlank(mentor.getMentorName())) keywords.add(mentor.getMentorName());
        if (!isBlank(mentor.getMentorCode())) keywords.add(mentor.getMentorCode());
        return new ArrayList<>(keywords);
    }

    private String getCellValue(Row row, int columnIndex) {
        Cell cell = row.getCell(columnIndex);
        return cell == null ? "" : dataFormatter.formatCellValue(cell).trim();
    }

    private Boolean parseActive(String value) {
        if (isBlank(value)) return true;
        String normalized = value.trim().toLowerCase();
        return normalized.equals("yes") || normalized.equals("true") || normalized.equals("1") || normalized.equals("active");
    }

    private boolean isEmptyRow(Row row) {
        for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
            if (!isBlank(getCellValue(row, i))) return false;
        }
        return true;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

