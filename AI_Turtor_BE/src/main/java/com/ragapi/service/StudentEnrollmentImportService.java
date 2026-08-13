package com.ragapi.service;

import com.ragapi.dto.MentorImportResponse;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.CourseEnrollmentRepository;
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
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@AllArgsConstructor
public class StudentEnrollmentImportService {

    private static final List<String> TEMPLATE_HEADERS = List.of(
            "Student ID",
            "Student Name"
    );

    private static final List<List<String>> SAMPLE_ROWS = List.of(
            List.of("SE1840001", "Nguyen Van A"),
            List.of("SE1840002", "Tran Thi B")
    );

    private final CourseEnrollmentRepository enrollmentRepository;
    private final DataFormatter dataFormatter = new DataFormatter();

    public MentorImportResponse importStudents(
            MultipartFile file,
            String courseId,
            String classId,
            String semesterId,
            String courseName,
            String status,
            boolean dryRun
    ) {
        MentorImportResponse response = new MentorImportResponse();
        List<String> successMessages = new ArrayList<>();
        List<String> errorMessages = new ArrayList<>();
        List<CourseEnrollment> enrollmentsToSave = new ArrayList<>();
        Set<String> studentsInFile = new HashSet<>();

        if (isBlank(courseId) || isBlank(classId)) {
            response.setSuccess(false);
            response.setMessage("courseId and classId are required");
            response.setTotalRows(0);
            response.setSuccessCount(0);
            response.setErrorCount(1);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(List.of("courseId and classId are required"));
            response.setDryRun(dryRun);
            return response;
        }

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
                    ParsedStudent student = parseStudent(row);
                    String validationError = validateStudent(student);
                    if (validationError != null) {
                        errorMessages.add("Row " + (i + 1) + ": " + validationError);
                        errorCount++;
                        continue;
                    }

                    String studentId = student.studentId().trim();
                    String studentKey = studentId.toLowerCase();
                    if (!studentsInFile.add(studentKey)) {
                        errorMessages.add("Row " + (i + 1) + ": duplicate student in file: " + studentId);
                        errorCount++;
                        continue;
                    }

                    CourseEnrollment enrollment = enrollmentRepository
                            .findByStudentIdAndCourseIdAndClassId(studentId, courseId.trim(), classId.trim())
                            .orElseGet(() -> CourseEnrollment.builder()
                                    .id(UUID.randomUUID().toString())
                                    .createdAt(LocalDateTime.now())
                                    .enrolledAt(LocalDateTime.now())
                                    .build());

                    enrollment.setStudentId(studentId);
                    enrollment.setStudentCode(studentId);
                    enrollment.setStudentName(student.studentName().trim());
                    enrollment.setStudentEmail(null);
                    enrollment.setStudentPhone(null);
                    enrollment.setSemesterId(trimToNull(semesterId));
                    enrollment.setCourseId(courseId.trim());
                    enrollment.setCourseName(trimToNull(courseName));
                    enrollment.setClassId(classId.trim());
                    enrollment.setClassName(null);
                    enrollment.setStatus(defaultStatus(status));
                    enrollment.setUpdatedAt(LocalDateTime.now());

                    enrollmentsToSave.add(enrollment);
                    successMessages.add("Row " + (i + 1) + ": " + studentId + " - " + enrollment.getStudentName() + " - OK");
                    successCount++;
                } catch (Exception e) {
                    errorMessages.add("Row " + (i + 1) + ": parse error - " + e.getMessage());
                    errorCount++;
                }
            }

            if (!dryRun && errorCount == 0 && !enrollmentsToSave.isEmpty()) {
                enrollmentRepository.saveAll(enrollmentsToSave);
                log.info("Imported {} students into course {} class {}", successCount, courseId, classId);
            }

            response.setSuccess(errorCount == 0);
            response.setTotalRows(totalRows);
            response.setSuccessCount(successCount);
            response.setErrorCount(errorCount);
            response.setSuccessMessages(successMessages);
            response.setErrorMessages(errorMessages);
            response.setMessage("Student import completed: " + successCount + " success, " + errorCount + " errors, " + totalRows + " total");
            response.setDryRun(dryRun);
        } catch (Exception e) {
            log.error("Error reading student enrollment import file", e);
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
    public byte[] buildTemplateWorkbook() throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Class Students");
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

    public List<String> getTemplateColumns() {
        return TEMPLATE_HEADERS;
    }

    private ParsedStudent parseStudent(Row row) {
        return new ParsedStudent(
                getCellValue(row, 0),
                getCellValue(row, 1)
        );
    }

    private String validateStudent(ParsedStudent student) {
        if (isBlank(student.studentId())) {
            return "Student ID must not be blank";
        }
        if (isBlank(student.studentName())) {
            return "Student Name must not be blank";
        }
        return null;
    }

    private String getCellValue(Row row, int columnIndex) {
        Cell cell = row.getCell(columnIndex);
        return cell == null ? "" : dataFormatter.formatCellValue(cell).trim();
    }

    private boolean isEmptyRow(Row row) {
        for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
            if (!isBlank(getCellValue(row, i))) return false;
        }
        return true;
    }

    private String defaultStatus(String status) {
        return isBlank(status) ? "ACTIVE" : status.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record ParsedStudent(String studentId, String studentName) {
    }
}





