import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileText, Users, GraduationCap } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db, Student, Mark, getSubjectsByClassAndGroup } from "@/lib/database";
import { MarksheetTemplate } from "@/components/MarksheetTemplate";

export interface StudentMarksheet {
  student: Student;
  marks: Mark[];
  gpa: number;
  totalGradePoints: number;
  subjects: number;
  sectionRank?: number;
  totalStudentsInSection?: number;
}

export function Marksheet() {
  const [mode, setMode] = useState<"individual" | "section" | "">("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedRoll, setSelectedRoll] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [studentMarksheet, setStudentMarksheet] =
    useState<StudentMarksheet | null>(null);
  const [sectionMarksheets, setSectionMarksheets] = useState<
    StudentMarksheet[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const marksheetRef = useRef<HTMLDivElement>(null);

  // Load students when class and section are selected
  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadStudents();
    }
  }, [selectedClass, selectedSection]);

  const loadStudents = async () => {
    if (!selectedClass || !selectedSection) return;

    try {
      const classStudents = await db.students
        .where({
          class: parseInt(selectedClass),
          section: selectedSection,
        })
        .sortBy("roll");

      setStudents(classStudents);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load students");
    }
  };

  const calculateGPA = (marks: Mark[]): number => {
    if (marks.length === 0) return 0;

    const totalGradePoints = marks.reduce(
      (sum, mark) => sum + mark.gradePoint,
      0,
    );
    return totalGradePoints / marks.length;
  };

  const loadIndividualMarksheet = async () => {
    if (!selectedClass || !selectedSection || !selectedRoll || !selectedExam)
      return;

    setLoading(true);
    try {
      const student = await db.students
        .where({
          class: parseInt(selectedClass),
          section: selectedSection,
          roll: parseInt(selectedRoll),
        })
        .first();

      if (!student) {
        toast.error("Student not found");
        return;
      }

      // Get all students in the same section for ranking
      const sectionStudents = await db.students
        .where({
          class: parseInt(selectedClass),
          section: selectedSection,
        })
        .toArray();

      // Get student's marks
      const studentMarks = await db.marks
        .where({
          studentId: student.id,
          exam: selectedExam,
        })
        .toArray();

      // Get all possible subjects for this class/group
      const allSubjects = getSubjectsByClassAndGroup(
        parseInt(selectedClass),
        studentMarks.find((m) => m.group)?.group,
      );

      // Create complete marks array with 0 for missing subjects
      const completeMarks: Mark[] = allSubjects.map((subject) => {
        const existingMark = studentMarks.find((m) => m.subject === subject);
        if (existingMark) {
          return existingMark;
        }

        // Create default mark entry for unenterd subjects
        return {
          studentId: student.id!,
          subject,
          exam: selectedExam,
          class: parseInt(selectedClass),
          section: selectedSection,
          group: studentMarks.find((m) => m.group)?.group,
          theory: 0,
          mcq: 0,
          practical: 0,
          total: 0,
          grade: "F",
          gradePoint: 0.0,
        } as Mark;
      });

      // Calculate GPA and ranking
      const enteredMarks = studentMarks.filter((m) => m.total > 0);
      const gpa = calculateGPA(enteredMarks);
      const totalGradePoints = enteredMarks.reduce(
        (sum, mark) => sum + mark.gradePoint,
        0,
      );

      // Calculate section ranking
      const sectionGPAs = await Promise.all(
        sectionStudents.map(async (s) => {
          const sMarks = await db.marks
            .where({
              studentId: s.id,
              exam: selectedExam,
            })
            .toArray();
          const sEnteredMarks = sMarks.filter((m) => m.total > 0);
          return {
            studentId: s.id,
            gpa: calculateGPA(sEnteredMarks),
          };
        }),
      );

      // Sort by GPA descending to get ranking
      const sortedGPAs = sectionGPAs
        .filter((s) => s.gpa > 0)
        .sort((a, b) => b.gpa - a.gpa);

      const sectionRank =
        sortedGPAs.findIndex((s) => s.studentId === student.id) + 1;

      setStudentMarksheet({
        student,
        marks: completeMarks,
        gpa,
        totalGradePoints,
        subjects: allSubjects.length,
        sectionRank: sectionRank || undefined,
        totalStudentsInSection: sortedGPAs.length,
      });
    } catch (error) {
      console.error("Error loading marksheet:", error);
      toast.error("Failed to load marksheet");
    } finally {
      setLoading(false);
    }
  };

  const loadSectionMarksheets = async () => {
    if (!selectedClass || !selectedSection || !selectedExam) return;

    setLoading(true);
    try {
      const classStudents = await db.students
        .where({
          class: parseInt(selectedClass),
          section: selectedSection,
        })
        .sortBy("roll");

      const marksheets: StudentMarksheet[] = [];

      // Get all students' marks first for ranking calculation
      const allStudentGPAs = [];

      for (const student of classStudents) {
        const studentMarks = await db.marks
          .where({
            studentId: student.id,
            exam: selectedExam,
          })
          .toArray();

        // Get all possible subjects for this class/group
        const allSubjects = getSubjectsByClassAndGroup(
          parseInt(selectedClass),
          studentMarks.find((m) => m.group)?.group,
        );

        // Create complete marks array with 0 for missing subjects
        const completeMarks: Mark[] = allSubjects.map((subject) => {
          const existingMark = studentMarks.find((m) => m.subject === subject);
          if (existingMark) {
            return existingMark;
          }

          // Create default mark entry for unenterd subjects
          return {
            studentId: student.id!,
            subject,
            exam: selectedExam,
            class: parseInt(selectedClass),
            section: selectedSection,
            group: studentMarks.find((m) => m.group)?.group,
            theory: 0,
            mcq: 0,
            practical: 0,
            total: 0,
            grade: "F",
            gradePoint: 0.0,
          } as Mark;
        });

        const enteredMarks = studentMarks.filter((m) => m.total > 0);
        const gpa = calculateGPA(enteredMarks);
        const totalGradePoints = enteredMarks.reduce(
          (sum, mark) => sum + mark.gradePoint,
          0,
        );

        allStudentGPAs.push({
          studentId: student.id,
          gpa,
        });

        marksheets.push({
          student,
          marks: completeMarks,
          gpa,
          totalGradePoints,
          subjects: allSubjects.length,
        });
      }

      // Calculate rankings
      const sortedGPAs = allStudentGPAs
        .filter((s) => s.gpa > 0)
        .sort((a, b) => b.gpa - a.gpa);

      // Add ranking to each marksheet
      const rankedMarksheets = marksheets.map((marksheet) => {
        const rank =
          sortedGPAs.findIndex((s) => s.studentId === marksheet.student.id) + 1;
        return {
          ...marksheet,
          sectionRank: rank || undefined,
          totalStudentsInSection: sortedGPAs.length,
        };
      });

      setSectionMarksheets(rankedMarksheets);
    } catch (error) {
      console.error("Error loading section marksheets:", error);
      toast.error("Failed to load section marksheets");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!marksheetRef.current) return;

    setGenerating(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");

      if (mode === "individual") {
        // For individual marksheet, use the existing method
        const canvas = await html2canvas(marksheetRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        // For section-wise marksheets, process each marksheet individually
        const marksheetElements = marksheetRef.current.querySelectorAll(
          ".individual-marksheet",
        );

        for (let i = 0; i < marksheetElements.length; i++) {
          const element = marksheetElements[i] as HTMLElement;

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
          });

          const imgData = canvas.toDataURL("image/png");
          const imgWidth = 210;
          const imgHeight = 297; // A4 height

          if (i > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        }
      }

      const fileName =
        mode === "individual"
          ? `marksheet_${studentMarksheet?.student.name}_${selectedExam}.pdf`
          : `marksheet_class${selectedClass}_section${selectedSection}_${selectedExam}.pdf`;

      pdf.save(fileName);
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📄 Marksheet Generator</h1>
        <p className="text-muted-foreground">
          Generate individual and section-wise marksheets with PDF export
        </p>
      </div>

      {/* Mode Selection */}
      {!mode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setMode("individual")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Individual Marksheet
              </CardTitle>
              <CardDescription>
                Generate marksheet for a specific student
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setMode("section")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Section-wise Marksheets
              </CardTitle>
              <CardDescription>
                Generate marksheets for all students in a section
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Individual Marksheet */}
      {mode === "individual" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Individual Marksheet Generator</CardTitle>
              <CardDescription>
                Select student details to generate marksheet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Exam *</Label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 7, 8, 9, 10].map((cls) => (
                        <SelectItem key={cls} value={cls.toString()}>
                          Class {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={selectedSection}
                    onValueChange={setSelectedSection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Section A</SelectItem>
                      <SelectItem value="B">Section B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Roll Number *</Label>
                  <Select value={selectedRoll} onValueChange={setSelectedRoll}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select roll" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem
                          key={student.id}
                          value={student.roll.toString()}
                        >
                          {student.roll} - {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={loadIndividualMarksheet}
                  disabled={
                    !selectedExam ||
                    !selectedClass ||
                    !selectedSection ||
                    !selectedRoll ||
                    loading
                  }
                >
                  {loading ? "Loading..." : "Generate Marksheet"}
                </Button>
                <Button variant="outline" onClick={() => setMode("")}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>

          {studentMarksheet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Marksheet Preview
                  <Button onClick={generatePDF} disabled={generating}>
                    <Download className="mr-2 h-4 w-4" />
                    {generating ? "Generating..." : "Download PDF"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div ref={marksheetRef}>
                  <MarksheetTemplate
                    marksheet={studentMarksheet}
                    selectedExam={selectedExam}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Section-wise Marksheets */}
      {mode === "section" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Section-wise Marksheet Generator</CardTitle>
              <CardDescription>
                Generate marksheets for all students in a section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Exam *</Label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 7, 8, 9, 10].map((cls) => (
                        <SelectItem key={cls} value={cls.toString()}>
                          Class {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={selectedSection}
                    onValueChange={setSelectedSection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Section A</SelectItem>
                      <SelectItem value="B">Section B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={loadSectionMarksheets}
                  disabled={
                    !selectedExam ||
                    !selectedClass ||
                    !selectedSection ||
                    loading
                  }
                >
                  {loading ? "Loading..." : "Generate Section Marksheets"}
                </Button>
                <Button variant="outline" onClick={() => setMode("")}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>

          {sectionMarksheets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Section Marksheets Preview
                  <Button onClick={generatePDF} disabled={generating}>
                    <Download className="mr-2 h-4 w-4" />
                    {generating ? "Generating..." : "Download PDF"}
                  </Button>
                </CardTitle>
                <CardDescription>
                  {sectionMarksheets.length} student(s) found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={marksheetRef}>
                  {sectionMarksheets.map((marksheet, index) => (
                    <div key={marksheet.student.id}>
                      <div className="individual-marksheet">
                        <MarksheetTemplate
                          marksheet={marksheet}
                          selectedExam={selectedExam}
                        />
                      </div>
                      {index < sectionMarksheets.length - 1 && (
                        <div
                          className="page-break"
                          style={{
                            pageBreakAfter: "always",
                            breakAfter: "page",
                            display: "block",
                            height: "0",
                            margin: "0",
                            padding: "0",
                            clear: "both",
                          }}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
