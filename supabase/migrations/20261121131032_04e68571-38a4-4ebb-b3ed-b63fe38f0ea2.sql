ALTER TABLE public.students
  ADD COLUMN placement_pending_at timestamp with time zone;

ALTER TABLE public.public_placement_invites
  ADD COLUMN teacher_id uuid,
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX students_teacher_placement_pending_idx
  ON public.students (teacher_id, updated_at DESC)
  WHERE deleted_at IS NULL AND placement_pending_at IS NULL;

CREATE INDEX public_placement_invites_teacher_id_idx
  ON public.public_placement_invites (teacher_id);

CREATE INDEX public_placement_invites_student_id_idx
  ON public.public_placement_invites (student_id);