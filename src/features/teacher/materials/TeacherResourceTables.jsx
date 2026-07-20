import { Database, FileText, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';

export default function TeacherResourceTables({
  classId,
  assignments,
  assignmentColumns,
  assignmentsLoading,
  onReloadAssignments,
  materials,
  materialColumns,
  onReloadMaterials,
}) {
  return (
    <>
      <div className="lg:col-span-2 mt-4" style={{ minWidth: 0 }}>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" /> Bài tập của lớp
              <Badge variant="secondary" className="ml-2 font-normal text-xs">{classId || 'Chưa chọn lớp'}</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onReloadAssignments} disabled={!classId || assignmentsLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${assignmentsLoading ? 'animate-spin' : ''}`} /> Làm mới
            </Button>
          </CardHeader>
          <CardContent className="p-0"><DataTable columns={assignmentColumns} data={assignments} /></CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2 mt-4" style={{ minWidth: 0 }}>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2"><Database className="w-5 h-5 text-gray-500" /> Tài liệu học tập đã tải lên</CardTitle>
              <CardDescription>Tài liệu được lập chỉ mục để AI Tutor truy xuất theo đúng môn và lớp.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onReloadMaterials}><RefreshCw className="w-4 h-4 mr-2" /> Làm mới</Button>
          </CardHeader>
          <CardContent className="p-0"><DataTable columns={materialColumns} data={materials} /></CardContent>
        </Card>
      </div>
    </>
  );
}
