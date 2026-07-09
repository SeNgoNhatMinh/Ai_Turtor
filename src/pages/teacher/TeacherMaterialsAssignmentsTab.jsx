import React, { useMemo, useState, Suspense } from 'react';
import { Database, Download, RefreshCw, Trash2, Upload, FileText, Send, Calendar, Globe } from 'lucide-react';
import { getClassOptionLabel, getClassOptionValue, getRecordId } from './teacherPortalUtils';
import ImportWebsiteModal from '../../components/importWebsite/ImportWebsiteModal';

// Shadcn UI components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';

function TeacherMaterialsAssignmentsTab({
  classId,
  classesList = [],
  materialTitle,
  setMaterialTitle,
  materialFile,
  setMaterialFile,
  isUploadingMaterial,
  handleTeacherUploadMaterial,
  newAssignmentTitle,
  setNewAssignmentTitle,
  newAssignmentDesc,
  setNewAssignmentDesc,
  newAssignmentClass,
  setNewAssignmentClass,
  newAssignmentDeadline,
  setNewAssignmentDeadline,
  newAssignmentFile,
  setNewAssignmentFile,
  newAssignmentTargetType,
  setNewAssignmentTargetType,
  newAssignmentTargetStudents,
  setNewAssignmentTargetStudents,
  isPublishingAssignment,
  onCreateAssignment,
  classAssignments = [],
  assignmentsLoading,
  loadClassAssignments,
  handleDownloadAssignmentFile,
  handleDeleteAssignment,
  courseMaterials = [],
  onReloadCourseMaterials,
  onDownloadMaterial,
  materialActionId,
  handleTeacherMaterialAction,
  apiService,
  triggerToast,
  currentUser,
  courseId,
}) {
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);

  const assignmentColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900">
          {row.getValue('title') || 'Untitled assignment'}
        </span>
      ),
    },
    {
      accessorKey: 'targetType',
      header: 'Target',
      cell: ({ row }) => (
        <Badge variant={row.getValue('targetType') === 'SELECTED_STUDENTS' ? 'secondary' : 'outline'} className={row.getValue('targetType') === 'SELECTED_STUDENTS' ? 'bg-orange-100 text-orange-600 hover:bg-orange-100 border-none' : 'bg-green-50 text-green-600 border-green-200'}>
          {row.getValue('targetType') || 'ALL_CLASS'}
        </Badge>
      ),
    },
    {
      accessorKey: 'dueAt',
      header: 'Due',
      cell: ({ row }) => {
        const val = row.getValue('dueAt');
        return <span className="text-gray-500 text-sm">{val ? new Date(val).toLocaleString() : '-'}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <span>{row.getValue('status') || 'Published'}</span>
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const assignment = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleDownloadAssignmentFile(assignment)}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteAssignment(assignment)}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        );
      }
    }
  ], [handleDownloadAssignmentFile, handleDeleteAssignment]);

  const materialColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Material Title',
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900">{row.getValue('title') || 'Untitled Material'}</span>
      )
    },
    {
      id: 'fileName',
      header: 'File Path / Name',
      cell: ({ row }) => {
        const mat = row.original;
        const id = getRecordId(mat);
        const name = mat.filePath || mat.fileName || mat.sourceFileName || id;
        return <span className="font-mono text-xs text-gray-500 truncate max-w-[200px] block" title={name}>{name}</span>;
      }
    },
    {
      accessorKey: 'classId',
      header: 'Class Code',
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
          {row.getValue('classId') || 'Course-wide'}
        </Badge>
      )
    },
    {
      accessorKey: 'createdAt',
      header: 'Uploaded Date',
      cell: ({ row }) => {
        const val = row.getValue('createdAt');
        return <span className="text-gray-500 text-sm">{val ? new Date(val).toLocaleString() : '-'}</span>;
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const mat = row.original;
        const materialId = getRecordId(mat);
        const isWebsite = mat.sourceType === 'HTML_URL';
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isWebsite} onClick={() => onDownloadMaterial?.(materialId, mat.title, mat)}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200" disabled={materialActionId === `reindex:${materialId}`} onClick={() => handleTeacherMaterialAction('reindex', mat)}>
              <Database className="w-3 h-3 mr-1" /> Reindex
            </Button>
            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={materialActionId === `delete:${materialId}`} onClick={() => handleTeacherMaterialAction('delete', mat)}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        );
      }
    }
  ], [onDownloadMaterial, materialActionId, handleTeacherMaterialAction]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
      {/* Upload Class Material */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
            <Upload className="w-5 h-5 text-orange-500" /> Upload Class Material
          </CardTitle>
          <CardDescription>Upload PDF materials to the AI Tutor's knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleTeacherUploadMaterial}>
            <div className="space-y-2">
              <Label htmlFor="materialTitle">Material Title</Label>
              <Input
                id="materialTitle"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="Leave empty to use file name"
                className="bg-gray-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialFile">File (PDF only)</Label>
              <Input
                id="materialFile"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setMaterialFile(e.target.files[0] || null)}
                className="bg-gray-50/50 file:text-orange-600 file:bg-orange-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-orange-100 transition-colors cursor-pointer"
                required
              />
            </div>
            {classId && (
              <div className="pt-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-normal">
                  Scoped to Class: <strong>{classId}</strong>
                </Badge>
              </div>
            )}
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 mt-2" disabled={isUploadingMaterial || !materialFile || !classId}>
              {isUploadingMaterial ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload Material</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50"
              disabled={isUploadingMaterial || !classId}
              onClick={() => setWebsiteImportOpen(true)}
            >
              <Globe className="w-4 h-4 mr-2" /> Import Website URL
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Publish New Assignment */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
            <Send className="w-5 h-5 text-blue-500" /> Publish New Assignment
          </CardTitle>
          <CardDescription>Create and publish a new assignment for your students.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onCreateAssignment}>
            <div className="space-y-2">
              <Label htmlFor="assignmentTitle">Assignment title</Label>
              <Input
                id="assignmentTitle"
                value={newAssignmentTitle}
                onChange={(e) => setNewAssignmentTitle(e.target.value)}
                required
                className="bg-gray-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignmentDesc">Assignment requirements</Label>
              <Textarea
                id="assignmentDesc"
                value={newAssignmentDesc}
                onChange={(e) => setNewAssignmentDesc(e.target.value)}
                required
                className="bg-gray-50/50 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Apply to class</Label>
                <Select value={newAssignmentClass} onValueChange={setNewAssignmentClass}>
                  <SelectTrigger className="bg-gray-50/50">
                    <SelectValue placeholder="Choose class" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classesList || []).map((item) => {
                      const value = getClassOptionValue(item);
                      return value ? (
                        <SelectItem key={value} value={value}>{getClassOptionLabel(item)}</SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Submission deadline</Label>
                <Input
                  type="datetime-local"
                  value={newAssignmentDeadline}
                  onChange={(e) => setNewAssignmentDeadline(e.target.value)}
                  required
                  className="bg-gray-50/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={newAssignmentTargetType} onValueChange={setNewAssignmentTargetType}>
                  <SelectTrigger className="bg-gray-50/50">
                    <SelectValue placeholder="Target audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_CLASS">Entire class</SelectItem>
                    <SelectItem value="SELECTED_STUDENTS">Selected students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment file</Label>
                <Input
                  type="file"
                  onChange={(e) => setNewAssignmentFile(e.target.files[0] || null)}
                  className="bg-gray-50/50 file:text-blue-600 file:bg-blue-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-blue-100 transition-colors cursor-pointer"
                  required
                />
              </div>
            </div>
            {newAssignmentTargetType === 'SELECTED_STUDENTS' && (
              <div className="space-y-2">
                <Label>Selected student IDs</Label>
                <Input
                  value={newAssignmentTargetStudents}
                  onChange={(e) => setNewAssignmentTargetStudents(e.target.value)}
                  placeholder="Example: SE1840001, SE1840002"
                  className="bg-gray-50/50"
                />
              </div>
            )}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-2" disabled={isPublishingAssignment || !newAssignmentFile || !newAssignmentClass}>
              {isPublishingAssignment ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Publish Assignment</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Class Assignments Table */}
      <div className="lg:col-span-2 mt-4" style={{ minWidth: 0 }}>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" /> Class Assignments
                <Badge variant="secondary" className="ml-2 font-normal text-xs">{classId || 'No class selected'}</Badge>
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={loadClassAssignments} disabled={!classId || assignmentsLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${assignmentsLoading ? 'animate-spin' : ''}`} /> Reload
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={assignmentColumns} data={classAssignments || []} />
          </CardContent>
        </Card>
      </div>

      {/* Uploaded Learning Materials Table */}
      <div className="lg:col-span-2 mt-4" style={{ minWidth: 0 }}>
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-500" /> Uploaded Learning Materials
              </CardTitle>
              <CardDescription>Documents embedded into the AI Tutor's RAG knowledge base.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onReloadCourseMaterials?.()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Reload
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={materialColumns} data={courseMaterials || []} />
          </CardContent>
        </Card>
      </div>
      {websiteImportOpen && (
        <Suspense fallback={null}>
          <ImportWebsiteModal
            open={websiteImportOpen}
            onClose={() => setWebsiteImportOpen(false)}
            courseId={courseId}
            classId={classId}
            currentUser={currentUser}
            apiService={apiService}
            triggerToast={triggerToast}
            onUploaded={onReloadCourseMaterials}
            isAdmin={false}
          />
        </Suspense>
      )}
    </div>
  );
}

export default TeacherMaterialsAssignmentsTab;
