import { lazy, Suspense } from 'react';
import AsyncState from '../../../components/common/AsyncState';
import { Tabs } from 'antd';

const ClassSectionsTab = lazy(() => import('./ClassSectionsTab'));
const CourseMaterialsTab = lazy(() => import('./CourseMaterialsTab'));
const CoursesTab = lazy(() => import('./CoursesTab'));
const StudentEnrollmentsTab = lazy(() => import('./StudentEnrollmentsTab'));
const StudentImportTab = lazy(() => import('./StudentImportTab'));
const TermsTab = lazy(() => import('./TermsTab'));

function TabFallback() {
  return <AsyncState loading compact loadingLabel="Đang tải dữ liệu học vụ..." loadingRows={5} />;
}

export default function AdminAcademicTabs({
  forms,
  academic,
  materials,
  studentImport,
  mentors,
  studentOptions,
  studentsLoading,
  onStudentSearch,
  triggerToast,
  onAcademicAction,
  onOpenEntity,
}) {
  const items = [
    {
      key: 'semesters',
      label: 'Học kỳ',
      children: (
        <Suspense fallback={<TabFallback />}>
          <TermsTab form={forms.semester} semesters={academic.semesters} onCreate={academic.handleCreateSemester} onReload={academic.loadSemesters} onAction={onAcademicAction} />
        </Suspense>
      ),
    },
    {
      key: 'courses',
      label: 'Môn học',
      children: (
        <Suspense fallback={<TabFallback />}>
          <CoursesTab form={forms.course} courses={academic.courses} onCreate={academic.handleCreateCourse} onReload={academic.loadCourses} onAction={onAcademicAction} />
        </Suspense>
      ),
    },
    {
      key: 'classes',
      label: 'Lớp học phần',
      children: (
        <Suspense fallback={<TabFallback />}>
          <ClassSectionsTab
            form={forms.classSection}
            courses={academic.courses}
            classSections={academic.classSections}
            selectedCourseId={academic.selectedCourseId}
            academicLoading={academic.academicLoading}
            mentors={mentors}
            onCreate={academic.handleCreateClass}
            onCourseSelect={academic.handleCourseSelect}
            onAction={onAcademicAction}
          />
        </Suspense>
      ),
    },
    {
      key: 'enrollments',
      label: 'Ghi danh sinh viên',
      children: (
        <Suspense fallback={<TabFallback />}>
          <StudentEnrollmentsTab
            form={forms.enrollment}
            courses={academic.courses}
            classSections={academic.classSections}
            studentOptions={studentOptions}
            studentsLoading={studentsLoading}
            enrollmentSearchId={academic.enrollmentSearchId}
            setEnrollmentSearchId={academic.setEnrollmentSearchId}
            studentEnrollments={academic.studentEnrollments}
            enrollmentsLoading={academic.enrollmentsLoading}
            onCreate={academic.handleCreateEnrollment}
            onCourseSelect={academic.handleCourseSelect}
            onStudentSearch={onStudentSearch}
            onSearch={academic.loadStudentEnrollments}
            onAction={onAcademicAction}
          />
        </Suspense>
      ),
    },
    {
      key: 'student-import',
      label: 'Import sinh viên',
      children: (
        <Suspense fallback={<TabFallback />}>
          <StudentImportTab
            form={forms.studentImport}
            courses={academic.courses}
            studentImportCourseId={studentImport.studentImportCourseId}
            studentImportClassId={studentImport.studentImportClassId}
            studentImportClasses={studentImport.studentImportClasses}
            studentImportFile={studentImport.studentImportFile}
            studentImportLoading={studentImport.studentImportLoading}
            studentImportResult={studentImport.studentImportResult}
            triggerToast={triggerToast}
            onDownloadTemplate={studentImport.handleDownloadStudentTemplate}
            onCourseChange={studentImport.loadStudentImportClasses}
            onClassChange={studentImport.setStudentImportClassId}
            onFileChange={studentImport.handleFileChange}
            onFileRemove={studentImport.handleFileRemove}
            onImport={studentImport.handleStudentImport}
          />
        </Suspense>
      ),
    },
    {
      key: 'materials',
      label: 'Học liệu môn học',
      children: (
        <Suspense fallback={<TabFallback />}>
          <CourseMaterialsTab
            form={forms.material}
            courses={academic.courses}
            materialCourseId={materials.materialCourseId}
            materialFile={materials.materialFile}
            materialUploadBusy={materials.materialUploadBusy}
            courseMaterials={materials.courseMaterials}
            materialsLoading={materials.materialsLoading}
            onCourseChange={materials.handleCourseChange}
            onFileChange={materials.setMaterialFile}
            onFileRemove={() => materials.setMaterialFile(null)}
            onUpload={materials.handleUploadMaterial}
            onOpenWebsiteImport={() => materials.setWebsiteImportOpen(true)}
            onReload={() => materials.loadCourseMaterials()}
            onMaterialAction={(key, record, materialId, meta) => {
              if (key === 'view' || key === 'edit') onOpenEntity('material', key, record);
              if (key === 'download') materials.handleDownloadMaterial(materialId, record.title, record);
              if (key === 'reindex') materials.handleReindexMaterial(materialId);
              if (key === 'delete') materials.handleDeleteMaterial(materialId, meta?.anchorRect);
            }}
          />
        </Suspense>
      ),
    },
  ];

  return (
    <Tabs
      defaultActiveKey="semesters"
      type="card"
      className="admin-academic-tabs"
      tabBarGutter={6}
      items={items}
    />
  );
}
