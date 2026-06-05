export const ROLE_INSTRUCTOR = "instructor" as const;
export const ROLE_STUDENT = "student" as const;

export type AvatarRole = typeof ROLE_INSTRUCTOR | typeof ROLE_STUDENT;

export const AVATAR_ROLES: { id: AvatarRole; name: string; emoji: string }[] = [
  { id: ROLE_INSTRUCTOR, name: "Instructor", emoji: "👩‍🏫" },
  { id: ROLE_STUDENT, name: "Student", emoji: "🧑‍💻" },
];
