import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { db, Student } from "@/lib/database";

export function AddStudent() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    roll: "",
    class: "",
    section: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (
        !formData.name ||
        !formData.roll ||
        !formData.class ||
        !formData.section
      ) {
        toast.error("All fields are required");
        return;
      }

      // Check if roll already exists in the same class and section
      const existingStudent = await db.students
        .where({
          roll: parseInt(formData.roll),
          class: parseInt(formData.class),
          section: formData.section,
        })
        .first();

      if (existingStudent) {
        toast.error(
          "A student with this roll number already exists in this class and section",
        );
        return;
      }

      const student: Student = {
        name: formData.name,
        roll: parseInt(formData.roll),
        class: parseInt(formData.class),
        section: formData.section,
      };

      await db.students.add(student);
      toast.success("Student added successfully!");

      // Reset form
      setFormData({
        name: "",
        roll: "",
        class: "",
        section: "",
      });

      // Navigate to students list
      navigate("/students");
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error("Failed to add student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const rollNumbers = Array.from({ length: 200 }, (_, i) => i + 1);
  const classes = [6, 7, 8, 9, 10];
  const sections = ["A", "B"];

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧑‍🎓 Add New Student
          </CardTitle>
          <CardDescription>
            Add a new student to GUZIA HIGH SCHOOL system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Student Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter student's full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roll">Roll Number *</Label>
              <Select
                value={formData.roll}
                onValueChange={(value) =>
                  setFormData({ ...formData, roll: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select roll number" />
                </SelectTrigger>
                <SelectContent>
                  {rollNumbers.map((roll) => (
                    <SelectItem key={roll} value={roll.toString()}>
                      {roll}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class">Class *</Label>
              <Select
                value={formData.class}
                onValueChange={(value) =>
                  setFormData({ ...formData, class: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls} value={cls.toString()}>
                      Class {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section">Section *</Label>
              <Select
                value={formData.section}
                onValueChange={(value) =>
                  setFormData({ ...formData, section: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Adding..." : "Add Student"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/students")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
