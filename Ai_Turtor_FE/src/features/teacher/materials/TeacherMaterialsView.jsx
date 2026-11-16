import { useMemo } from 'react';
import { Select } from 'antd';
import TeacherResourceTables from './TeacherResourceTables';
import { useTeacherResourceColumns } from './useTeacherResourceColumns';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionLabel,
  getClassOptionValue,
} from '../shared/teacherUtils';

export default function TeacherMaterialsView({
  scope,
  materials,
  courseMaterials = [],
  onReloadCourseMaterials,
  onDownloadMaterial,
}) {
  const { materialColumns } = useTeacherResourceColumns({
    materialActions: {
      onDownload: onDownloadMaterial,
      canManage: () => false,
      pendingId: materials.actionId,
    },
  });
  const classOptions = useMemo(() => (scope.classesList || [])
    .map((item) => {
      const value = getClassOptionValue(item);
      const optionCourseId = getClassCourseId(item);
      const label = getClassOptionLabel(item);
      return value ? {
        value: String(value),
        label: optionCourseId ? `${label} · ${optionCourseId}` : label,
        searchLabel: `${label} ${item?.classCode || ''} ${value} ${optionCourseId}`,
        classId: String(value),
        courseId: String(optionCourseId || ''),
      } : null;
    })
    .filter(Boolean), [scope.classesList]);
  const selectedClass = findTeacherClass(scope.classesList, scope.classId);
  const selectedClassValue = selectedClass ? String(getClassOptionValue(selectedClass)) : undefined;

  return (
    <div className="teacher-materials-grid">
      <label className="teacher-form-field" htmlFor="materialClass">
        <span>Lớp học phần</span>
        <Select
          id="materialClass"
          aria-label="Lớp học phần"
          showSearch
          value={selectedClassValue}
          placeholder="Chọn lớp để xem học liệu"
          optionFilterProp="searchLabel"
          options={classOptions}
          loading={scope.classesLoading}
          disabled={scope.classesLoading || classOptions.length === 0}
          notFoundContent={scope.classesLoading ? 'Đang tải lớp...' : 'Không có lớp được phân công'}
          onChange={(value, option) => scope.onClassChange?.(value, option)}
        />
      </label>

      <TeacherResourceTables
        materials={courseMaterials}
        materialColumns={materialColumns}
        onReloadMaterials={onReloadCourseMaterials}
      />
    </div>
  );
}
