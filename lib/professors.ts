export type ProfessorCourse = { id: string; name: string };
export type Professor = {
  googleId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  courses: ProfessorCourse[];
};

type CourseWithTeachers = {
  id: string;
  name: string;
  teachers: { googleId: string; name: string; email: string | null; photoUrl: string | null }[];
};

/**
 * A Teacher row is per-course, so the same person teaching two courses has
 * two rows — group by googleId and merge, since the email/photo may only be
 * populated on one of them depending on sync order.
 */
export function groupProfessors(courses: CourseWithTeachers[]): Professor[] {
  const byId = new Map<string, Professor>();
  for (const course of courses) {
    for (const t of course.teachers) {
      const existing = byId.get(t.googleId);
      if (existing) {
        existing.courses.push({ id: course.id, name: course.name });
        existing.email ??= t.email;
        existing.photoUrl ??= t.photoUrl;
      } else {
        byId.set(t.googleId, {
          googleId: t.googleId,
          name: t.name,
          email: t.email,
          photoUrl: t.photoUrl,
          courses: [{ id: course.id, name: course.name }],
        });
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
