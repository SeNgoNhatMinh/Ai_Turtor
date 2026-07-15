import { Globe, RefreshCw, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TeacherMaterialUploadCard({
  classId,
  materialTitle,
  setMaterialTitle,
  materialFile,
  setMaterialFile,
  isUploading,
  onUpload,
  onOpenWebsiteImport,
}) {
  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-800"><Upload className="w-5 h-5 text-orange-500" /> Upload Class Material</CardTitle>
        <CardDescription>Upload PDF materials to the AI Tutor&apos;s knowledge base.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onUpload}>
          <div className="space-y-2">
            <Label htmlFor="materialTitle">Material Title</Label>
            <Input id="materialTitle" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="Leave empty to use file name" className="bg-gray-50/50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="materialFile">File (PDF only)</Label>
            <Input
              id="materialFile"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setMaterialFile(event.target.files[0] || null)}
              className="bg-gray-50/50 file:text-orange-600 file:bg-orange-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-orange-100 transition-colors cursor-pointer"
              required
            />
          </div>
          {classId && <div className="pt-2"><Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-normal">Scoped to Class: <strong>{classId}</strong></Badge></div>}
          <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 mt-2" disabled={isUploading || !materialFile || !classId}>
            {isUploading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Upload Material</>}
          </Button>
          <Button type="button" variant="outline" className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50" disabled={isUploading || !classId} onClick={onOpenWebsiteImport}>
            <Globe className="w-4 h-4 mr-2" /> Import Website URL
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
