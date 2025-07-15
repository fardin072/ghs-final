import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, UploadCloud, DownloadCloud } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { db, Student } from "@/lib/database";
import * as XLSX from "xlsx";

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [classFilter, setClassFilter] = useState<string>("All");
  const [sectionFilter, setSectionFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, classFilter, sectionFilter]);

  const loadStudents = async () => {
    try {
      setError(null);
      const allStudents = await db.students.toArray();
      const sorted = allStudents.sort((a, b) => a.roll - b.roll);
      setStudents(sorted);
    } catch (err) {
      setError("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...students];
    if (classFilter !== "All") {
      result = result.filter((s) => String(s.class) === classFilter);
    }
    if (sectionFilter !== "All") {
      result = result.filter((s) => s.section === sectionFilter);
    }
    setFiltered(result);
  };

  const confirmDelete = (student: Student) => {
    setSelectedStudent(student);
    setOpenModal(true);
  };

  const handleDelete = async () => {
    if (selectedStudent) {
      try {
        await db.students.delete(selectedStudent.id!);
        toast({
          title: "Student deleted",
          description: `${selectedStudent.name} has been removed.`,
        });
        await loadStudents();
        setSelectedStudent(null);
        setOpenModal(false);
      } catch {
        toast({
          variant: "destructive",
          title: "Delete failed",
        });
      }
    }
  };

  const handleDownload = async () => {
    try {
      const students = await db.students.toArray();
      const worksheet = XLSX.utils.json_to_sheet(students);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      XLSX.writeFile(workbook, "students.xlsx");
      toast({ title: "Downloaded student data." });
    } catch {
      toast({ variant: "destructive", title: "Download failed" });
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      const grouped = new Map<string, Student>();
      rows.forEach((row) => {
        const key = `${row.Name}-${row.Roll}-${row.Class}-${row.Section}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: crypto.randomUUID(),
            name: row.Name,
            roll: row.Roll,
            class: row.Class,
            section: row.Section,
            group: row.Group || "",
          });
        }
      });

      const parsed = Array.from(grouped.values());
      const isReplace = confirm("Replace (OK) or Merge (Cancel)?");

      if (isReplace) {
        await db.students.clear();
        await db.students.bulkAdd(parsed);
        toast({ title: "Replaced student data." });
      } else {
        const existing = await db.students.toArray();
        const ids = new Set(existing.map((s) => `${s.name}-${s.roll}-${s.class}-${s.section}`));
        const newOnes = parsed.filter((s) => !ids.has(`${s.name}-${s.roll}-${s.class}-${s.section}`));
        await db.students.bulkAdd(newOnes);
        toast({ title: `Merged ${newOnes.length} students.` });
      }

      await loadStudents();
    } catch {
      toast({ variant: "destructive", title: "Invalid Excel file" });
    } finally {
      event.target.value = "";
    }
  };

  const allClasses = Array.from(new Set(students.map((s) => s.class))).sort();
  const allSections = Array.from(new Set(students.map((s) => s.section))).sort();

  if (loading) {
    return <div className="text-center py-10">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">📋 Student List</h1>
          <p className="text-muted-foreground">
            Manage all students in GUZIA HIGH SCHOOL
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/add-student">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </Link>
          <Button variant="outline" onClick={handleDownload}>
            <DownloadCloud className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button variant="outline" onClick={handleUploadClick}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload
          </Button>
          <input
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm font-medium">Filter by Class</label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {allClasses.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Filter by Section</label>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {allSections.map((sec) => (
                <SelectItem key={sec} value={sec}>
                  {sec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>{filtered.length} student(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No students match selected filters.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((student) => (
                <div
                  key={student.id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Roll: {student.roll}, Class: {student.class}, Section: {student.section}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDelete(student)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={openModal} onOpenChange={setOpenModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedStudent?.name}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}