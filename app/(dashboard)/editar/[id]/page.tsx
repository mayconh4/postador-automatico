"use client";

import { EditorShell } from "@/components/editor/editor-shell";

export default function EditarIdPage({ params }: { params: { id: string } }) {
  return <EditorShell editId={params.id} />;
}
